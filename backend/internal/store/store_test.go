package store

import (
	"encoding/binary"
	"os"
	"testing"
	"time"
)

func TestWorkspaceAndJournalSurviveRestart(t *testing.T) {
	dir := t.TempDir()
	s, e := Open(dir)
	if e != nil {
		t.Fatal(e)
	}
	f, e := s.AddFolder("Research", "studio")
	if e != nil {
		t.Fatal(e)
	}
	d, e := s.AddDocument("An idea", f.ID)
	if e != nil {
		t.Fatal(e)
	}
	time.Sleep(time.Millisecond)
	update := []byte{1, 4, 9, 12}
	if e = s.Append(d.ID, update); e != nil {
		t.Fatal(e)
	}
	again, e := Open(dir)
	if e != nil {
		t.Fatal(e)
	}
	updates, e := again.ReadJournal(d.ID)
	if e != nil || len(updates) != 1 || string(updates[0]) != string(update) {
		t.Fatalf("journal mismatch: %v %v", updates, e)
	}
	for _, got := range again.List().Documents {
		if got.ID == d.ID {
			if got.Name != d.Name || got.FolderID != f.ID || got.UpdatedAt <= d.CreatedAt {
				t.Fatalf("metadata mismatch: %+v", got)
			}
			return
		}
	}
	t.Fatal("document lost")
}
func TestFolderCyclesAndNonEmptyDeletionAreRejected(t *testing.T) {
	s, _ := Open(t.TempDir())
	a, _ := s.AddFolder("A", "")
	b, _ := s.AddFolder("B", a.ID)
	if _, e := s.UpdateFolder(a.ID, nil, &b.ID); e == nil {
		t.Fatal("cycle allowed")
	}
	if e := s.DeleteFolder(a.ID); e == nil {
		t.Fatal("nonempty folder deleted")
	}
	d, _ := s.AddDocument("Note", b.ID)
	if e := s.DeleteFolder(b.ID); e == nil {
		t.Fatal("folder with document deleted")
	}
	if e := s.DeleteDocument(d.ID); e != nil {
		t.Fatal(e)
	}
	if e := s.DeleteFolder(b.ID); e != nil {
		t.Fatal(e)
	}
	if e := s.DeleteFolder(a.ID); e != nil {
		t.Fatal(e)
	}
}
func TestTruncatedFinalRecordRecovery(t *testing.T) {
	s, _ := Open(t.TempDir())
	d, _ := s.AddDocument("Crash recovery", "")
	_ = s.Append(d.ID, []byte{9, 8, 7})
	f, _ := os.OpenFile(s.journalPath(d.ID), os.O_APPEND|os.O_WRONLY, 0600)
	header := make([]byte, 4)
	binary.BigEndian.PutUint32(header, 8)
	_, _ = f.Write(append(header, 1, 2))
	_ = f.Close()
	updates, e := s.ReadJournal(d.ID)
	if e != nil || len(updates) != 1 {
		t.Fatalf("recovery: %v %v", updates, e)
	}
	_ = s.Append(d.ID, []byte{6, 5})
	updates, e = s.ReadJournal(d.ID)
	if e != nil || len(updates) != 2 {
		t.Fatal("journal not writable after recovery")
	}
}
func TestIDsAndMissingParents(t *testing.T) {
	s, _ := Open(t.TempDir())
	if _, e := s.ReadJournal("../../outside"); e != ErrNotFound {
		t.Fatal("path traversal accepted")
	}
	if _, e := s.AddDocument("Note", "missing"); e != ErrNotFound {
		t.Fatal("invalid parent accepted")
	}
	if e := s.Append("missing", []byte{1}); e != ErrNotFound {
		t.Fatal("missing document accepted")
	}
}
