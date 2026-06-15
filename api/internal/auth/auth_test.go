package auth

import "testing"

func TestHashAndCheckPassword(t *testing.T) {
	hash, err := HashPassword("secret-pass")
	if err != nil {
		t.Fatalf("HashPassword: %v", err)
	}
	if !CheckPassword(hash, "secret-pass") {
		t.Error("correct password rejected")
	}
	if CheckPassword(hash, "wrong-pass") {
		t.Error("wrong password accepted")
	}
}

func TestIssueAndParseToken(t *testing.T) {
	const secret = "test-secret"
	const managerID = "00000000-0000-0000-0000-000000000042"

	token, err := IssueToken(secret, managerID)
	if err != nil {
		t.Fatalf("IssueToken: %v", err)
	}

	got, err := ParseToken(secret, token)
	if err != nil {
		t.Fatalf("ParseToken: %v", err)
	}
	if got != managerID {
		t.Errorf("subject = %q, want %q", got, managerID)
	}

	if _, err := ParseToken("other-secret", token); err == nil {
		t.Error("token accepted with wrong secret")
	}
	if _, err := ParseToken(secret, "not-a-token"); err == nil {
		t.Error("garbage token accepted")
	}
}
