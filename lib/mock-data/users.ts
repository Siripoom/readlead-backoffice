export type UserStatus = 'active' | 'inactive' | 'banned'

export interface UserItem {
  id: string
  name: string
  email: string
  joinedAt: string
  status: UserStatus
}

export interface CreatorItem extends UserItem {
  works: number
  followers: number
}

export interface AdminItem extends UserItem {
  role: string
  lastLogin: string
}

