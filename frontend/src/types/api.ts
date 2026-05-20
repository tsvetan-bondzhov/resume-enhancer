export interface AuthResponse {
  token: string
  user?: UserDto
}

export interface SignupRequest {
  email: string
  password: string
}

export interface UserDto {
  id: string
  email: string
  role: "USER" | "ADMIN"
}

export interface ApiErrorResponse {
  type: string
  title: string
  status: number
  detail: string
  instance: string
}

export interface ResumeDto {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

export interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: string
}

export interface ProfileDto {
  id: string
  userId: string
  fullName: string
  email: string
  updatedAt: string
}
