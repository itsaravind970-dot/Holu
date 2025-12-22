
export type Role = 'user' | 'model';
export type HuluMode = 'normal' | 'pro';

export interface MessagePart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

export interface ChatMessage {
  id: string;
  role: Role;
  parts: MessagePart[];
  timestamp: number;
  isStarred?: boolean;
  groundingSources?: Array<{
    web?: {
      uri: string;
      title: string;
    };
  }>;
}

export interface ChatSessionHistory {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: number;
}

export interface UserAccount {
  id: string;
  username: string;
  chatbotName: string;
  phoneNumber: string;
  password?: string;
  bio?: string;
  createdAt: number;
  lastLoginAt?: number;
  searchCount?: number;
  isBlocked?: boolean;
  profilePic?: string;
}
