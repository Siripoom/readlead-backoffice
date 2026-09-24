export function activePunishmentWhere(now = new Date()) {
  return {
    status: 'active',
    OR: [
      { expiresAt: null },
      { expiresAt: { gt: now } },
    ],
  }
}

export function hasActivePunishment(member: { punishments?: readonly { id: string }[] }) {
  return (member.punishments?.length ?? 0) > 0
}
