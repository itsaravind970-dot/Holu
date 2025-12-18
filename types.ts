
export type Role = 'user' | 'model';

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
  isAudio?: boolean;
  groundingSources?: Array<{
    web?: {
      uri: string;
      title: string;
    };
    maps?: {
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
