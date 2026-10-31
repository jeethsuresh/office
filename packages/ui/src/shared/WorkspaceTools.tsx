import { createContext, useContext, useState, type ReactNode } from "react";

const WorkspaceToolsContext = createContext<{
  header: HTMLDivElement | null;
  setHeader: (element: HTMLDivElement | null) => void;
} | null>(null);

export function WorkspaceToolsProvider({ children }: { children: ReactNode }) {
  const [header, setHeader] = useState<HTMLDivElement | null>(null);
  return (
    <WorkspaceToolsContext.Provider value={{ header, setHeader }}>
      {children}
    </WorkspaceToolsContext.Provider>
  );
}

export const useWorkspaceTools = () => useContext(WorkspaceToolsContext);

export function WorkspaceToolsSlot() {
  const scope = useWorkspaceTools();
  return <div className="workspace-tools" ref={scope?.setHeader} />;
}

const BlockToolsContext = createContext<{
  active: boolean;
  focused: string;
  fallback: string;
  setFocused: React.Dispatch<React.SetStateAction<string>>;
} | null>(null);

export function BlockToolsProvider({
  children,
  active,
  blockID,
}: {
  children: ReactNode;
  active: boolean;
  blockID: string;
}) {
  const fallback = `block:${blockID}`;
  const [focused, setFocused] = useState(fallback);
  return (
    <BlockToolsContext.Provider
      value={{ active, focused, fallback, setFocused }}
    >
      {children}
    </BlockToolsContext.Provider>
  );
}

export const useBlockTools = () => useContext(BlockToolsContext);
