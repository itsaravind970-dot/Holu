
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
  isMediaGeneration?: boolean;
  mediaType?: 'image' | 'video';
  mediaUrl?: string;
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

export interface SavedProjectItem {
  id: string;
  type: 'code' | 'topic';
  content: string;
  language?: string;
  timestamp: number;
  title: string;
}
