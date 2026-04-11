import { getPrisma } from "./prisma";

export async function getUserWorkspaces(userId: string) {
  return getPrisma().workspace.findMany({
    where: {
      OR: [{ ownerId: userId }, { members: { some: { userId } } }],
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getWorkspaceIdsForUser(userId: string) {
  const workspaces = await getUserWorkspaces(userId);
  return workspaces.map((workspace) => workspace.id);
}

export async function getWorkspaceByIdIfMember(
  workspaceId: string,
  userId: string,
) {
  return getPrisma().workspace.findFirst({
    where: {
      id: workspaceId,
      OR: [{ ownerId: userId }, { members: { some: { userId } } }],
    },
  });
}

export async function createWorkspace(ownerId: string, name: string) {
  return getPrisma().workspace.create({
    data: {
      name,
      ownerId,
      members: {
        create: {
          userId: ownerId,
          role: "owner",
        },
      },
    },
  });
}

export async function createWorkspaceInvite(
  workspaceId: string,
  inviteeEmail: string,
  invitedById: string,
) {
  return getPrisma().workspaceInvite.create({
    data: {
      workspaceId,
      inviteeEmail: inviteeEmail.toLowerCase().trim(),
      invitedById,
    },
  });
}

export async function getPendingInvitesForEmail(email: string) {
  return getPrisma().workspaceInvite.findMany({
    where: {
      inviteeEmail: email.toLowerCase().trim(),
      status: "pending",
    },
    include: {
      workspace: true,
      invitedBy: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function acceptWorkspaceInvite(
  inviteId: string,
  userId: string,
  email: string,
) {
  const invite = await getPrisma().workspaceInvite.findUnique({
    where: { id: inviteId },
  });

  if (!invite) {
    return null;
  }

  if (invite.inviteeEmail !== email.toLowerCase().trim()) {
    return null;
  }

  if (invite.status !== "pending") {
    return null;
  }

  const membership = await getPrisma().workspaceMember.upsert({
    where: {
      workspaceId_userId: {
        workspaceId: invite.workspaceId,
        userId,
      },
    },
    update: {},
    create: {
      workspaceId: invite.workspaceId,
      userId,
      role: "member",
    },
  });

  await getPrisma().workspaceInvite.update({
    where: { id: inviteId },
    data: {
      status: "accepted",
      acceptedAt: new Date(),
      inviteeId: userId,
    },
  });

  return membership;
}
