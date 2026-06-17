package repository_test

import (
	"os"
	"testing"
)

// dsnFromEnv returns the DATABASE_URL env var, or skips the test if not set.
func dsnFromEnv(t *testing.T) string {
	t.Helper()
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL not set — skipping integration test")
	}
	return dsn
}
