"use client";

import Image from "next/image";
import { FaTimes } from "react-icons/fa";

interface ProfileEditModalProps {
  isOpen: boolean;
  profileName: string;
  profileImage: string | null;
  profileInitial: string;
  isAvatarUploading: boolean;
  isProfileSaving: boolean;
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
  isPasswordSaving: boolean;
  passwordFormError: string | null;
  onClose: () => void;
  onProfileNameChange: (value: string) => void;
  onAvatarUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onProfileSave: () => void;
  onCurrentPasswordChange: (value: string) => void;
  onNewPasswordChange: (value: string) => void;
  onConfirmNewPasswordChange: (value: string) => void;
  onPasswordUpdate: () => void;
  onPasswordFieldChange: () => void;
}

export default function ProfileEditModal({
  isOpen,
  profileName,
  profileImage,
  profileInitial,
  isAvatarUploading,
  isProfileSaving,
  currentPassword,
  newPassword,
  confirmNewPassword,
  isPasswordSaving,
  passwordFormError,
  onClose,
  onProfileNameChange,
  onAvatarUpload,
  onProfileSave,
  onCurrentPasswordChange,
  onNewPasswordChange,
  onConfirmNewPasswordChange,
  onPasswordUpdate,
  onPasswordFieldChange,
}: ProfileEditModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <div
        className="group relative w-full max-w-xl overflow-hidden rounded-2xl border border-slate-700/80 bg-[#0b121c] shadow-[0_28px_80px_-42px_rgba(0,0,0,0.95)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="absolute inset-0 rounded-3xl bg-gradient-to-b from-white/5 via-transparent to-transparent opacity-0 transition-opacity duration-300 pointer-events-none group-hover:opacity-100"></div>
        <div className="relative z-10">
          <div className="flex items-start justify-between gap-4 border-b border-gray-800 px-6 py-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Edit Profile</h2>
              <p className="text-sm text-slate-400">
                Update your display name, avatar, and password.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-gray-700 bg-slate-950 px-3 py-2 text-sm text-slate-300 transition hover:border-slate-600 hover:text-white"
              aria-label="Close edit profile modal"
            >
              <FaTimes className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-4 p-6">
            <div className="space-y-3 rounded-xl border border-gray-700/30 bg-slate-900/40 p-4">
              <div className="flex items-center gap-3">
                <div className="h-14 w-14 overflow-hidden rounded-2xl bg-blue-600 text-lg font-bold text-white flex items-center justify-center">
                  {profileImage ? (
                    <Image
                      src={profileImage}
                      alt="Profile avatar"
                      width={56}
                      height={56}
                      unoptimized
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    profileInitial
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Display name
                  </p>
                  <input
                    type="text"
                    value={profileName}
                    onChange={(event) =>
                      onProfileNameChange(event.target.value)
                    }
                    placeholder="Your name"
                    maxLength={80}
                    className="mt-2 w-full rounded-xl border border-gray-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-blue-500/50"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <label
                  htmlFor="profile-avatar-modal-input"
                  className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-700/50 bg-slate-900/50 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-blue-500/50 hover:bg-slate-800"
                >
                  {isAvatarUploading ? "Uploading..." : "Upload avatar"}
                </label>
                <input
                  id="profile-avatar-modal-input"
                  type="file"
                  accept="image/*"
                  onChange={onAvatarUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={onProfileSave}
                  disabled={isProfileSaving}
                  className="inline-flex items-center rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isProfileSaving ? "Saving..." : "Save profile"}
                </button>
              </div>
            </div>

            <div className="space-y-2 rounded-xl border border-gray-700/30 bg-slate-900/40 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Update password
              </p>
              <input
                type="password"
                value={currentPassword}
                onChange={(event) => {
                  onCurrentPasswordChange(event.target.value);
                  onPasswordFieldChange();
                }}
                placeholder="Current password"
                className="w-full rounded-xl border border-gray-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-blue-500/50"
              />
              <input
                type="password"
                value={newPassword}
                onChange={(event) => {
                  onNewPasswordChange(event.target.value);
                  onPasswordFieldChange();
                }}
                placeholder="New password (min. 8 chars)"
                className="w-full rounded-xl border border-gray-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-blue-500/50"
              />
              <input
                type="password"
                value={confirmNewPassword}
                onChange={(event) => {
                  onConfirmNewPasswordChange(event.target.value);
                  onPasswordFieldChange();
                }}
                placeholder="Confirm new password"
                className="w-full rounded-xl border border-gray-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-blue-500/50"
              />
              {passwordFormError && (
                <p className="text-xs text-red-400">{passwordFormError}</p>
              )}
              <button
                type="button"
                onClick={onPasswordUpdate}
                disabled={isPasswordSaving}
                className="inline-flex items-center rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPasswordSaving ? "Updating..." : "Update password"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
