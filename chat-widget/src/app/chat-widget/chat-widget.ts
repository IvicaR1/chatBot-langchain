import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewChecked,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

@Component({
  selector: 'app-chat-widget',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat-widget.html',
  styleUrl: './chat-widget.scss',
})
export class ChatWidgetComponent implements AfterViewChecked {
  @ViewChild('messageList') private messageList!: ElementRef<HTMLDivElement>;

  isOpen = false;
  isLoading = false;
  limitReached = false;
  userInput = '';
  messages: Message[] = [];

  private readonly API = 'http://localhost:8000/chat';
  private shouldScroll = false;

  constructor(private http: HttpClient) {}

  ngAfterViewChecked() {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  toggle() {
    this.isOpen = !this.isOpen;
    if (this.isOpen) this.shouldScroll = true;
  }

  send() {
    const text = this.userInput.trim();
    if (!text || this.isLoading || this.limitReached) return;

    this.messages.push({ role: 'user', content: text });
    this.userInput = '';
    this.isLoading = true;
    this.shouldScroll = true;

    this.http
      .post<{ reply: string; limitReached: boolean }>(this.API, {
        messages: this.messages,
      })
      .subscribe({
        next: (res) => {
          if (res.reply) {
            this.messages.push({ role: 'assistant', content: res.reply });
          }
          this.limitReached = res.limitReached;
          this.isLoading = false;
          this.shouldScroll = true;
        },
        error: () => {
          this.messages.push({
            role: 'assistant',
            content: 'Something went wrong. Please try again or visit neocom.com.mk.',
          });
          this.isLoading = false;
          this.shouldScroll = true;
        },
      });
  }

  clearChat() {
    this.messages = [];
    this.limitReached = false;
  }

  onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  private scrollToBottom() {
    try {
      const el = this.messageList.nativeElement;
      el.scrollTop = el.scrollHeight;
    } catch {}
  }
}
