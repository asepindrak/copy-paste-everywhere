"use client";

import Select, { type SingleValue } from "react-select";
import { FaTimes } from "react-icons/fa";

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
  workspaceOptions: WorkspaceOption[];
  selectedWorkspaceOption: WorkspaceOption;
  workspaceCreateName: string;
  workspaceInviteEmail: string;
  workspaceInfo: string | null;
  pendingInvites: PendingInvite[];
  isWorkspaceSaving: boolean;
  isInviteSaving: boolean;
  onClose: () => void;
  onWorkspaceCreateNameChange: (value: string) => void;
  onWorkspaceInviteEmailChange: (value: string) => void;
  onWorkspaceSelect: (option: SingleValue<WorkspaceOption>) => void;
  onCreateWorkspace: () => void;
  onSendInvite: () => void;
  onAcceptInvite: (inviteId: string) => void;
}

export default function WorkspaceModal({
  activeWorkspaceName,
  workspaceOptions,
  selectedWorkspaceOption,
  workspaceCreateName,
  workspaceInviteEmail,
  workspaceInfo,
  pendingInvites,
  isWorkspaceSaving,
  isInviteSaving,
  onClose,
  onWorkspaceCreateNameChange,
  onWorkspaceInviteEmailChange,
  onWorkspaceSelect,
  onCreateWorkspace,
  onSendInvite,
  onAcceptInvite,
}: WorkspaceModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl flex flex-col">
        <div className="flex items-start justify-between gap-4 border-b border-slate-800 px-6 py-4">
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
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-700 bg-slate-950 text-slate-300 transition hover:border-slate-600 hover:text-white"
            aria-label="Close workspace manager"
          >
            <FaTimes className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-6 custom-scrollbar">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-5">
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
                className="min-w-0 flex-1 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
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

          <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-5">
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
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-5">
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
                className="min-w-0 flex-1 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                placeholder="name@example.com"
              />
              <button
                type="button"
                onClick={onSendInvite}
                disabled={isInviteSaving || !selectedWorkspaceOption.value}
                className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isInviteSaving ? "Sending..." : "Send Invite"}
              </button>
            </div>
            {!selectedWorkspaceOption.value && (
              <p className="mt-2 text-sm text-slate-500">
                Select an active workspace before inviting teammates.
              </p>
            )}
          </div>

          {workspaceInfo && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 text-sm text-slate-200">
              {workspaceInfo}
            </div>
          )}

          {pendingInvites.length > 0 && (
            <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 text-sm text-slate-200">
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
                    className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:flex-row sm:items-center sm:justify-between"
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
                      className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
                    >
                      Accept invite
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
