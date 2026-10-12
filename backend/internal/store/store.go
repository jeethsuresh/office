// Package store owns durable workspace metadata and opaque Yjs update journals.
package store

import (
	"crypto/rand"
	_ "embed"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"sync"
	"time"
)

//go:embed welcome.bin
var welcome []byte

var ErrNotFound = errors.New("not found")
var idPattern = regexp.MustCompile(`^[a-zA-Z0-9_-]{1,80}$`)

func ValidID(id string) bool { return idPattern.MatchString(id) }
func NewID() string          { b := make([]byte, 12); _, _ = rand.Read(b); return hex.EncodeToString(b) }

type Folder struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	ParentID string `json:"parentId"`
}
type Document struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	FolderID  string `json:"folderId"`
	CreatedAt string `json:"createdAt"`
	UpdatedAt string `json:"updatedAt"`
}
type Workspace struct {
	ID        string     `json:"id"`
	Folders   []Folder   `json:"folders"`
	Documents []Document `json:"documents"`
}
type Store struct {
	mu        sync.Mutex
	dir       string
	workspace Workspace
}

func now() string { return time.Now().UTC().Format(time.RFC3339Nano) }
func Open(dir string) (*Store, error) {
	if err := os.MkdirAll(filepath.Join(dir, "journals"), 0700); err != nil {
		return nil, err
	}
	s := &Store{dir: dir}
	b, err := os.ReadFile(filepath.Join(dir, "workspace.json"))
	if err == nil {
		if err = json.Unmarshal(b, &s.workspace); err != nil {
			return nil, fmt.Errorf("workspace is unreadable: %w", err)
		}
		if s.workspace.ID == "" {
			s.workspace.ID = NewID()
			if err = s.save(); err != nil {
				return nil, err
			}
		}
		return s, nil
	}
	if !os.IsNotExist(err) {
		return nil, err
	}
	t := now()
	s.workspace = Workspace{ID: NewID(), Folders: []Folder{{ID: "studio", Name: "Studio", ParentID: ""}}, Documents: []Document{{ID: "welcome", Name: "Welcome", FolderID: "studio", CreatedAt: t, UpdatedAt: t}}}
	if err = s.writeJournal("welcome", welcome); err != nil {
		return nil, err
	}
	return s, s.save()
}
func (s *Store) save() error {
	b, err := json.MarshalIndent(s.workspace, "", "  ")
	if err != nil {
		return err
	}
	p := filepath.Join(s.dir, "workspace.json")
	f, err := os.OpenFile(p+".tmp", os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0600)
	if err != nil {
		return err
	}
	if _, err = f.Write(b); err == nil {
		err = f.Sync()
	}
	closeErr := f.Close()
	if err != nil {
		return err
	}
	if closeErr != nil {
		return closeErr
	}
	return os.Rename(p+".tmp", p)
}
func (s *Store) commit(old Workspace) error {
	if err := s.save(); err != nil {
		s.workspace = old
		return err
	}
	return nil
}
func (s *Store) List() Workspace {
	s.mu.Lock()
	defer s.mu.Unlock()
	return Workspace{ID: s.workspace.ID, Folders: append([]Folder{}, s.workspace.Folders...), Documents: append([]Document{}, s.workspace.Documents...)}
}
func (s *Store) hasFolder(id string) bool {
	if id == "" {
		return true
	}
	for _, f := range s.workspace.Folders {
		if f.ID == id {
			return true
		}
	}
	return false
}
func (s *Store) HasDocument(id string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.hasDocument(id)
}
func (s *Store) hasDocument(id string) bool {
	for _, d := range s.workspace.Documents {
		if d.ID == id {
			return true
		}
	}
	return false
}
func (s *Store) AddFolder(name, parent string) (Folder, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !s.hasFolder(parent) {
		return Folder{}, ErrNotFound
	}
	old := s.workspace
	f := Folder{NewID(), name, parent}
	s.workspace.Folders = append(append([]Folder{}, old.Folders...), f)
	return f, s.commit(old)
}
func (s *Store) AddDocument(name, folder string) (Document, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !s.hasFolder(folder) {
		return Document{}, ErrNotFound
	}
	old := s.workspace
	t := now()
	d := Document{NewID(), name, folder, t, t}
	s.workspace.Documents = append(append([]Document{}, old.Documents...), d)
	return d, s.commit(old)
}
func (s *Store) UpdateDocument(id string, name, folder *string) (Document, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	old := s.workspace
	s.workspace.Documents = append([]Document{}, old.Documents...)
	if folder != nil && !s.hasFolder(*folder) {
		return Document{}, ErrNotFound
	}
	for i, d := range s.workspace.Documents {
		if d.ID == id {
			if name != nil {
				d.Name = *name
			}
			if folder != nil {
				d.FolderID = *folder
			}
			d.UpdatedAt = now()
			s.workspace.Documents[i] = d
			return d, s.commit(old)
		}
	}
	return Document{}, ErrNotFound
}
func (s *Store) UpdateFolder(id string, name, parent *string) (Folder, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if parent != nil {
		if !s.hasFolder(*parent) {
			return Folder{}, ErrNotFound
		}
		p := *parent
		for p != "" {
			if p == id {
				return Folder{}, errors.New("a folder cannot contain itself")
			}
			next := ""
			for _, f := range s.workspace.Folders {
				if f.ID == p {
					next = f.ParentID
					break
				}
			}
			p = next
		}
	}
	old := s.workspace
	s.workspace.Folders = append([]Folder{}, old.Folders...)
	for i, f := range s.workspace.Folders {
		if f.ID == id {
			if name != nil {
				f.Name = *name
			}
			if parent != nil {
				f.ParentID = *parent
			}
			s.workspace.Folders[i] = f
			return f, s.commit(old)
		}
	}
	return Folder{}, ErrNotFound
}
func (s *Store) DeleteDocument(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	old := s.workspace
	docs := []Document{}
	found := false
	for _, d := range old.Documents {
		if d.ID == id {
			found = true
		} else {
			docs = append(docs, d)
		}
	}
	if !found {
		return ErrNotFound
	}
	s.workspace.Documents = docs
	return s.commit(old)
}
func (s *Store) DeleteFolder(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, f := range s.workspace.Folders {
		if f.ParentID == id {
			return errors.New("move or delete nested folders first")
		}
	}
	for _, d := range s.workspace.Documents {
		if d.FolderID == id {
			return errors.New("move or delete documents first")
		}
	}
	old := s.workspace
	folders := []Folder{}
	found := false
	for _, f := range old.Folders {
		if f.ID == id {
			found = true
		} else {
			folders = append(folders, f)
		}
	}
	if !found {
		return ErrNotFound
	}
	s.workspace.Folders = folders
	return s.commit(old)
}
func (s *Store) journalPath(id string) string { return filepath.Join(s.dir, "journals", id+".ylog") }
func (s *Store) writeJournal(id string, update []byte) error {
	f, err := os.OpenFile(s.journalPath(id), os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0600)
	if err != nil {
		return err
	}
	defer f.Close()
	frame := make([]byte, 4+len(update))
	binary.BigEndian.PutUint32(frame, uint32(len(update)))
	copy(frame[4:], update)
	start, err := f.Seek(0, io.SeekEnd)
	if err != nil {
		return err
	}
	if _, err = f.Write(frame); err != nil {
		_ = f.Truncate(start)
		return err
	}
	return f.Sync()
}

// Append syncs content before the WebSocket acknowledgement. Metadata is saved too.
func (s *Store) Append(id string, update []byte) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !ValidID(id) || !s.hasDocument(id) {
		return ErrNotFound
	}
	if len(update) > 16<<20 {
		return errors.New("update too large")
	}
	if err := s.writeJournal(id, update); err != nil {
		return err
	}
	old := s.workspace
	s.workspace.Documents = append([]Document{}, old.Documents...)
	for i := range s.workspace.Documents {
		if s.workspace.Documents[i].ID == id {
			s.workspace.Documents[i].UpdatedAt = now()
		}
	}
	return s.commit(old)
}

// ReadJournal truncates only an incomplete final record left by an interrupted write.
func (s *Store) ReadJournal(id string) ([][]byte, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !ValidID(id) || !s.hasDocument(id) {
		return nil, ErrNotFound
	}
	f, err := os.OpenFile(s.journalPath(id), os.O_RDWR, 0600)
	if os.IsNotExist(err) {
		return [][]byte{}, nil
	}
	if err != nil {
		return nil, err
	}
	defer f.Close()
	updates := [][]byte{}
	var offset int64
	for {
		header := make([]byte, 4)
		_, err := io.ReadFull(f, header)
		if err == io.EOF {
			return updates, nil
		}
		if err == io.ErrUnexpectedEOF {
			return updates, f.Truncate(offset)
		}
		if err != nil {
			return nil, err
		}
		n := binary.BigEndian.Uint32(header)
		if n > 16<<20 {
			return nil, errors.New("corrupt journal record")
		}
		b := make([]byte, n)
		_, err = io.ReadFull(f, b)
		if err == io.EOF || err == io.ErrUnexpectedEOF {
			return updates, f.Truncate(offset)
		}
		if err != nil {
			return nil, err
		}
		updates = append(updates, b)
		offset += int64(4 + n)
	}
}
