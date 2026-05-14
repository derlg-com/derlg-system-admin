import { IsString, IsNumber, IsOptional, IsObject } from 'class-validator';

export class WebhookUpdateDto {
  @IsNumber()
  update_id: number;

  @IsObject()
  @IsOptional()
  message?: {
    message_id: number;
    from: {
      id: number;
      is_bot: boolean;
      first_name: string;
      username?: string;
      language_code?: string;
    };
    chat: {
      id: number;
      first_name: string;
      type: string;
    };
    date: number;
    text?: string;
    location?: {
      latitude: number;
      longitude: number;
    };
  };

  @IsObject()
  @IsOptional()
  callback_query?: {
    id: string;
    from: {
      id: number;
      is_bot: boolean;
      first_name: string;
    };
    message?: any;
    data?: string;
  };
}
