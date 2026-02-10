import { db, members, roles, memberRoles, servers } from "@quarrel/db";
import { eq, and } from "drizzle-orm";
import { PERMISSIONS } from "@quarrel/shared";

/**
 * Compute the combined permission bitmask for a user in a server.
 * Server owners implicitly have all permissions.
 * Returns the combined bitmask, or null if the user is not a member.
 */
export async function getMemberPermissions(
  userId: string,
  serverId: string
): Promise<number | null> {
  // Check if user is the server owner (all permissions)
  const [server] = await db
    .select({ ownerId: servers.ownerId })
    .from(servers)
    .where(eq(servers.id, serverId))
    .limit(1);

  if (!server) return null;

  if (server.ownerId === userId) {
    // Owner has all permissions
    return Object.values(PERMISSIONS).reduce((a, b) => a | b, 0);
  }

  // Find the member record
  const [member] = await db
    .select({ id: members.id })
    .from(members)
    .where(and(eq(members.userId, userId), eq(members.serverId, serverId)))
    .limit(1);

  if (!member) return null;

  // Get all roles for this member
  const userRoles = await db
    .select({ permissions: roles.permissions })
    .from(memberRoles)
    .innerJoin(roles, eq(memberRoles.roleId, roles.id))
    .where(eq(memberRoles.memberId, member.id));

  // Combine all role permissions
  let bitmask = 0;
  for (const role of userRoles) {
    bitmask |= role.permissions;
  }

  return bitmask;
}

/**
 * Check if a user has a specific permission in a server.
 * Returns true if the user has the permission (or is server owner).
 * Returns null if the user is not a member.
 */
export async function hasPermission(
  userId: string,
  serverId: string,
  permission: number
): Promise<boolean | null> {
  const perms = await getMemberPermissions(userId, serverId);
  if (perms === null) return null;

  // ADMINISTRATOR grants all permissions
  if (perms & PERMISSIONS.ADMINISTRATOR) return true;

  return (perms & permission) === permission;
}
