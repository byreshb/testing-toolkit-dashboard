interface EmptyStateProps {
  tool: string;
  expected: string;
  docs?: string;
}

/** Shown when a tool's files are absent from the data directory. */
export function EmptyState({ tool, expected, docs = "docs/data-format.md" }: EmptyStateProps) {
  return (
    <div className="empty" data-testid="empty-state">
      No {tool} data found. Expected {expected} under the data directory; see {docs} for the layout.
    </div>
  );
}
