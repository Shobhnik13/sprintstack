CREATE INDEX issues_fts_idx ON issues
  USING GIN (to_tsvector('english', title || ' ' || COALESCE(description, '')));
