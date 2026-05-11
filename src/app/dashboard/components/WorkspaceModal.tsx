"use client";

import Select, { type SingleValue } from "react-select";
import { FaSignOutAlt, FaSpinner, FaTimes, FaTrash } from "react-icons/fa";

export type WorkspaceOption = {
  value: string;
  label: string;
};

type PendingInvite = {
  id: string;
  workspace?: { name?: string } | null;
  invitedBy?: { email?: string } | null;
};

interface WorkspaceModalProps {
  activeWorkspaceName: string | null;
  activeWorkspaceOwnerLabel: string | null;
  workspaceOptions: WorkspaceOption[];
  selectedWorkspaceOption: WorkspaceOption;
  workspaceCreateName: string;
  workspaceInviteEmail: string;
  workspaceInfo: string | null;
  pendingInvites: PendingInvite[];
  isWorkspaceSaving: boolean;
  isInviteSaving: boolean;
  isWorkspaceDeleting: boolean;
  isWorkspaceLeaving: boolean;
  acceptingInviteId: string | null;
  canDeleteActiveWorkspace: boolean;
  canLeaveActiveWorkspace: boolean;
  workspaceDeleteConfirmation: string;
  onClose: () => void;
  onWorkspaceCreateNameChange: (value: string) => void;
  onWorkspaceInviteEmailChange: (value: string) => void;
  onWorkspaceDeleteConfirmationChange: (value: string) => void;
  onWorkspaceSelect: (option: SingleValue<WorkspaceOption>) => void;
  onCreateWorkspace: () => void;
  onSendInvite: () => void;
  onAcceptInvite: (inviteId: string) => void;
  onDeleteWorkspace: () => void;
  onLeaveWorkspace: () => void;
}

export default function WorkspaceModal({
  activeWorkspaceName,
  activeWorkspaceOwnerLabel,
  workspaceOptions,
  selectedWorkspaceOption,
  workspaceCreateName,
  workspaceInviteEmail,
  workspaceInfo,
  pendingInvites,
  isWorkspaceSaving,
  isInviteSaving,
  isWorkspaceDeleting,
  isWorkspaceLeaving,
  onClose,
  onWorkspaceCreateNameChange,
  onWorkspaceInviteEmailChange,
  onWorkspaceDeleteConfirmationChange,
  onWorkspaceSelect,
  onCreateWorkspace,
  onSendInvite,
  onAcceptInvite,
  onDeleteWorkspace,
  onLeaveWorkspace,
  acceptingInviteId,
  canDeleteActiveWorkspace,
  canLeaveActiveWorkspace,
  workspaceDeleteConfirmation,
}: WorkspaceModalProps) {
  const selectedWorkspaceName =
    selectedWorkspaceOption.value && selectedWorkspaceOption.label
      ? selectedWorkspaceOption.label
      : "";
  const canSubmitDelete =
    Boolean(selectedWorkspaceOption.value) &&
    canDeleteActiveWorkspace &&
    workspaceDeleteConfirmation.trim() === selectedWorkspaceName &&
    !isWorkspaceDeleting;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-700/80 bg-[#0b121c] shadow-[0_28px_80px_-42px_rgba(0,0,0,0.95)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-800 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Workspace Manager
            </h2>
            <p className="text-sm text-slate-400">
              Create a workspace or invite teammates to the selected workspace.
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Active workspace:{" "}
              <span className="font-semibold text-white">
                {activeWorkspaceName ?? "Personal clipboard"}
              </span>
            </p>
            {activeWorkspaceOwnerLabel && (
              <p className="mt-1 text-sm text-slate-500">
                Owner:{" "}
                <span className="font-semibold text-slate-200">
                  {activeWorkspaceOwnerLabel}
                </span>
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-700 bg-slate-950 text-slate-300 transition hover:border-slate-600 hover:text-white"
            aria-label="Close workspace manager"
          >
            <FaTimes className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-6 custom-scrollbar">
          <div className="rounded-2xl border border-slate-700/80 bg-slate-950/70 p-5">
            <label
              className="block text-sm font-medium text-slate-300"
              htmlFor="workspace-name-modal"
            >
              New workspace name
            </label>
            <div className="mt-3 flex gap-2">
              <input
                id="workspace-name-modal"
                value={workspaceCreateName}
                onChange={(event) =>
                  onWorkspaceCreateNameChange(event.target.value)
                }
                className="min-w-0 flex-1 rounded-2xl border border-gray-700/40 bg-slate-900/50 px-4 py-3 text-sm text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                placeholder="Team clipboard"
              />
              <button
                type="button"
                onClick={onCreateWorkspace}
                disabled={isWorkspaceSaving}
                className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isWorkspaceSaving ? "Creating..." : "Create Workspace"}
              </button>
            </div>
          </div>

          {selectedWorkspaceOption.value && (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-200">
                  <FaSignOutAlt className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-amber-100">
                    Leave workspace
                  </h3>
                  <p className="mt-1 text-sm text-amber-100/75">
                    Remove yourself from {selectedWorkspaceName}. Workspace
                    history stays available for remaining members.
                  </p>
                  <button
                    type="button"
                    onClick={onLeaveWorkspace}
                    disabled={!canLeaveActiveWorkspace || isWorkspaceLeaving}
                    className="mt-3 inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isWorkspaceLeaving ? (
                      <>
                        <FaSpinner className="h-4 w-4 animate-spin" />
                        Leaving...
                      </>
                    ) : (
                      "Leave Workspace"
                    )}
                  </button>
                  {!canLeaveActiveWorkspace && (
                    <p className="mt-2 text-sm text-amber-100/60">
                      Workspace owner cannot leave. Delete the workspace instead
                      or transfer ownership first.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {selectedWorkspaceOption.value && (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-500/20 text-red-300">
                  <FaTrash className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-red-100">
                    Delete workspace
                  </h3>
                  <p className="mt-1 text-sm text-red-100/75">
                    This deletes the selected workspace and its clipboard
                    history. Type or paste the workspace name to confirm.
                  </p>
                  <p className="mt-3 rounded-xl border border-red-500/20 bg-black/20 px-3 py-2 text-sm font-semibold text-white">
                    {selectedWorkspaceName}
                  </p>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <input
                      type="text"
                      value={workspaceDeleteConfirmation}
                      onChange={(event) =>
                        onWorkspaceDeleteConfirmationChange(event.target.value)
                      }
                      className="min-w-0 flex-1 rounded-2xl border border-red-500/30 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none focus:border-red-400 focus:ring-2 focus:ring-red-500/20"
                      placeholder={selectedWorkspaceName}
                      disabled={isWorkspaceDeleting}
                    />
                    <button
                      type="button"
                      onClick={onDeleteWorkspace}
                      disabled={!canSubmitDelete}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isWorkspaceDeleting ? (
                        <>
                          <FaSpinner className="h-4 w-4 animate-spin" />
                          Deleting...
                        </>
                      ) : (
                        "Delete Workspace"
                      )}
                    </button>
                  </div>
                  {!canDeleteActiveWorkspace && (
                    <p className="mt-2 text-sm text-red-100/60">
                      Only the workspace owner
                      {activeWorkspaceOwnerLabel
                        ? ` (${activeWorkspaceOwnerLabel})`
                        : ""}{" "}
                      can delete this workspace.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-slate-700/80 bg-slate-950/70 p-5">
            <label
              className="block text-sm font-medium text-slate-300"
              htmlFor="workspace-select-modal"
            >
              Select workspace for invites
            </label>
            <div className="mt-3">
              <Select
                instanceId="workspace-select-modal"
                inputId="workspace-select-modal-input"
                options={workspaceOptions}
                value={selectedWorkspaceOption}
                onChange={onWorkspaceSelect}
                menuPortalTarget={
                  typeof document !== "undefined" ? document.body : undefined
                }
                className="react-select-container"
                classNamePrefix="react-select"
                styles={{
                  control: (base) => ({
                    ...base,
                    backgroundColor: "#0f172a",
                    borderColor: "#334155",
                    color: "#fff",
                    minHeight: "42px",
                  }),
                  singleValue: (base) => ({
                    ...base,
                    color: "#fff",
                  }),
                  menu: (base) => ({
                    ...base,
                    backgroundColor: "#0f172a",
                    zIndex: 9999,
                  }),
                  menuPortal: (base) => ({
                    ...base,
                    zIndex: 9999,
                  }),
                  option: (base, state) => ({
                    ...base,
                    backgroundColor: state.isFocused ? "#1e293b" : "#0f172a",
                    color: state.isSelected ? "#fff" : "#cbd5e1",
                  }),
                }}
                theme={(theme) => ({
                  ...theme,
                  borderRadius: 12,
                  colors: {
                    ...theme.colors,
                    primary25: "#1e293b",
                    primary: "#3b82f6",
                    neutral0: "#0f172a",
                    neutral80: "#e2e8f0",
                  },
                })}
              />
            </div>
            {activeWorkspaceOwnerLabel && (
              <p className="mt-3 text-sm text-slate-400">
                Owner:{" "}
                <span className="font-semibold text-slate-200">
                  {activeWorkspaceOwnerLabel}
                </span>
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-slate-700/80 bg-slate-950/70 p-5">
            <label
              className="block text-sm font-medium text-slate-300"
              htmlFor="invite-email-modal"
            >
              Invite teammate by email
            </label>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                id="invite-email-modal"
                type="email"
                value={workspaceInviteEmail}
                onChange={(event) =>
                  onWorkspaceInviteEmailChange(event.target.value)
                }
                className="min-w-0 flex-1 rounded-2xl border border-gray-700/40 bg-slate-900/50 px-4 py-3 text-sm text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                placeholder="name@example.com"
              />
              <button
                type="button"
                onClick={onSendInvite}
                disabled={isInviteSaving || !selectedWorkspaceOption.value}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isInviteSaving ? (
                  <>
                    <FaSpinner className="h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  "Send Invite"
                )}
              </button>
            </div>
            {!selectedWorkspaceOption.value && (
              <p className="mt-2 text-sm text-slate-500">
                Select an active workspace before inviting teammates.
              </p>
            )}
          </div>

          {workspaceInfo && (
            <div className="rounded-2xl border border-gray-800 bg-slate-950/90 p-4 text-sm text-slate-200">
              {workspaceInfo}
            </div>
          )}

          {pendingInvites.length > 0 && (
            <div className="rounded-2xl border border-slate-700/80 bg-slate-950/70 p-4 text-sm text-slate-200">
              <div className="mb-3 flex items-center justify-between">
                <span className="font-semibold text-white">
                  Pending Workspace Invites
                </span>
                <span className="text-xs uppercase tracking-[0.2em] text-slate-500">
                  Accept to join
                </span>
              </div>
              <div className="space-y-3">
                {pendingInvites.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex flex-col gap-3 rounded-2xl border border-gray-800 bg-gray-900 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="text-sm text-slate-300">
                        Invite to{" "}
                        <span className="font-semibold text-white">
                          {invite.workspace?.name}
                        </span>
                      </p>
                      <p className="text-xs text-slate-500">
                        From {invite.invitedBy?.email || "unknown"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onAcceptInvite(invite.id)}
                      disabled={acceptingInviteId === invite.id}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {acceptingInviteId === invite.id ? (
                        <>
                          <FaSpinner className="h-4 w-4 animate-spin" />
                          Accepting...
                        </>
                      ) : (
                        "Accept invite"
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
