package handler

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/brassfoot/api/internal/middleware"
	"github.com/brassfoot/api/internal/model"
	"github.com/brassfoot/api/internal/repository"
	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5"
)

// ----------- fakes -----------

type fakeManagerStore struct {
	manager      model.Manager
	getErr       error
	updateCalled bool
}

func (f *fakeManagerStore) GetByID(_ context.Context, _ string) (model.Manager, error) {
	return f.manager, f.getErr
}

func (f *fakeManagerStore) UpdateTeamID(_ context.Context, _, _ string) error {
	f.updateCalled = true
	return nil
}

type fakeTeamLookup struct {
	team   model.Team
	getErr error
}

func (f *fakeTeamLookup) GetByID(_ context.Context, _ string) (model.Team, error) {
	return f.team, f.getErr
}

type fakeCareerLookup struct {
	career *model.Career
}

func (f *fakeCareerLookup) GetByManagerID(_ context.Context, _ string) (model.Career, error) {
	if f.career == nil {
		return model.Career{}, repository.ErrCareerNotFound
	}
	return *f.career, nil
}

// ----------- helpers -----------

// newSelectTeamApp wires a ManagerHandler into a minimal Fiber app that
// injects a hard-coded manager id (bypassing JWT) so tests don't need auth.
func newSelectTeamApp(h *ManagerHandler) *fiber.App {
	app := fiber.New(fiber.Config{
		ErrorHandler: func(c *fiber.Ctx, err error) error {
			code := fiber.StatusInternalServerError
			if fe, ok := err.(*fiber.Error); ok {
				code = fe.Code
			}
			return c.Status(code).JSON(fiber.Map{"message": err.Error()})
		},
	})
	app.Use(func(c *fiber.Ctx) error {
		c.Locals(middleware.ManagerIDKey, "manager-001")
		return c.Next()
	})
	app.Post("/manager/team", h.SelectTeam)
	return app
}

func newSelectTeamReq(teamID string) *http.Request {
	req := httptest.NewRequest("POST", "/manager/team",
		strings.NewReader(`{"team_id":"`+teamID+`"}`))
	req.Header.Set("Content-Type", "application/json")
	return req
}

// ----------- tests -----------

// TestSelectTeam_NoCareer_Succeeds: a manager with no career can set their team.
func TestSelectTeam_NoCareer_Succeeds(t *testing.T) {
	mgrStore := &fakeManagerStore{manager: model.Manager{ID: "manager-001", TeamID: "team-001"}}
	h := NewManagerHandler(
		mgrStore,
		&fakeTeamLookup{team: model.Team{ID: "team-001", Name: "Flamengo"}},
		&fakeCareerLookup{career: nil},
	)
	resp, err := newSelectTeamApp(h).Test(newSelectTeamReq("team-001"))
	if err != nil {
		t.Fatalf("app.Test: %v", err)
	}
	if resp.StatusCode != fiber.StatusOK {
		t.Errorf("status: got %d, want %d (OK)", resp.StatusCode, fiber.StatusOK)
	}
	if !mgrStore.updateCalled {
		t.Error("expected UpdateTeamID to be called when no career exists")
	}
}

// TestSelectTeam_ActiveCareer_Returns409: once a career exists the team is locked.
func TestSelectTeam_ActiveCareer_Returns409(t *testing.T) {
	mgrStore := &fakeManagerStore{manager: model.Manager{ID: "manager-001"}}
	h := NewManagerHandler(
		mgrStore,
		&fakeTeamLookup{team: model.Team{ID: "team-001"}},
		&fakeCareerLookup{career: &model.Career{ID: "career-001", ManagerID: "manager-001"}},
	)
	resp, err := newSelectTeamApp(h).Test(newSelectTeamReq("team-001"))
	if err != nil {
		t.Fatalf("app.Test: %v", err)
	}
	if resp.StatusCode != fiber.StatusConflict {
		t.Errorf("status: got %d, want %d (Conflict)", resp.StatusCode, fiber.StatusConflict)
	}
}

// TestSelectTeam_CareerLock_NoDBWrite: the career lock fires before UpdateTeamID.
func TestSelectTeam_CareerLock_NoDBWrite(t *testing.T) {
	mgrStore := &fakeManagerStore{manager: model.Manager{ID: "manager-001"}}
	h := NewManagerHandler(
		mgrStore,
		&fakeTeamLookup{team: model.Team{ID: "team-001"}},
		&fakeCareerLookup{career: &model.Career{ID: "career-001", ManagerID: "manager-001"}},
	)
	if _, err := newSelectTeamApp(h).Test(newSelectTeamReq("team-001")); err != nil {
		t.Fatalf("app.Test: %v", err)
	}
	if mgrStore.updateCalled {
		t.Error("UpdateTeamID must not be called when career lock is active")
	}
}

// TestSelectTeam_TeamNotFound_Returns404: invalid team_id → 404.
func TestSelectTeam_TeamNotFound_Returns404(t *testing.T) {
	h := NewManagerHandler(
		&fakeManagerStore{manager: model.Manager{ID: "manager-001"}},
		&fakeTeamLookup{getErr: pgx.ErrNoRows},
		&fakeCareerLookup{career: nil},
	)
	resp, err := newSelectTeamApp(h).Test(newSelectTeamReq("no-such-team"))
	if err != nil {
		t.Fatalf("app.Test: %v", err)
	}
	if resp.StatusCode != fiber.StatusNotFound {
		t.Errorf("status: got %d, want %d (NotFound)", resp.StatusCode, fiber.StatusNotFound)
	}
}

// TestSelectTeam_EmptyTeamID_Returns400: missing team_id → 400.
func TestSelectTeam_EmptyTeamID_Returns400(t *testing.T) {
	h := NewManagerHandler(&fakeManagerStore{}, &fakeTeamLookup{}, &fakeCareerLookup{})
	req := newSelectTeamReq("")
	resp, err := newSelectTeamApp(h).Test(req)
	if err != nil {
		t.Fatalf("app.Test: %v", err)
	}
	if resp.StatusCode != fiber.StatusBadRequest {
		t.Errorf("status: got %d, want %d (BadRequest)", resp.StatusCode, fiber.StatusBadRequest)
	}
}
