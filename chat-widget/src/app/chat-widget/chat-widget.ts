import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewChecked,
  ChangeDetectorRef,
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
  isRecording = false;
  isTranscribing = false;
  isSpeaking = false;
  limitReached = false;
  userInput = '';
  messages: Message[] = [];

  private readonly API = 'http://localhost:8000/chat';
  private readonly TRANSCRIBE_API = 'http://localhost:8000/transcribe';
  private shouldScroll = false;
  private mediaRecorder?: MediaRecorder;
  private audioChunks: Blob[] = [];
  private lastInputWasVoice = false;

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  ngAfterViewChecked() {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  toggle() {
    this.isOpen = !this.isOpen;
    if (this.isOpen) this.shouldScroll = true;
    if (!this.isOpen) this.stopSpeaking();
  }

  send() {
    const text = this.userInput.trim();
    if (!text || this.isLoading || this.limitReached) return;

    this.messages.push({ role: 'user', content: text });
    this.userInput = '';
    this.isLoading = true;
    this.shouldScroll = true;

    const voiceTriggered = this.lastInputWasVoice;
    this.lastInputWasVoice = false;

    this.http
      .post<{ reply: string; limitReached: boolean }>(this.API, {
        messages: this.messages,
      })
      .subscribe({
        next: (res) => {
          if (res.reply) {
            this.messages.push({ role: 'assistant', content: res.reply });
            if (voiceTriggered) this.speak(res.reply);
          }
          this.limitReached = res.limitReached;
          this.isLoading = false;
          this.shouldScroll = true;
          this.cdr.detectChanges();
        },
        error: () => {
          this.messages.push({
            role: 'assistant',
            content: 'Something went wrong. Please try again or visit neocom.com.mk.',
          });
          this.isLoading = false;
          this.shouldScroll = true;
          this.cdr.detectChanges();
        },
      });
  }

  async startRecording() {
    if (this.isLoading || this.limitReached || this.isRecording) return;
    this.stopSpeaking();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioChunks = [];
      this.mediaRecorder = new MediaRecorder(stream);
      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) this.audioChunks.push(e.data);
      };
      this.mediaRecorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        this.sendAudio();
      };
      this.mediaRecorder.start();
      this.isRecording = true;
      this.cdr.detectChanges();
    } catch {
      // microphone permission denied
    }
  }

  stopRecording() {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
      this.isRecording = false;
      this.isTranscribing = true;
      this.cdr.detectChanges();
    }
  }

  private sendAudio() {
    const blob = new Blob(this.audioChunks, { type: 'audio/webm' });
    const formData = new FormData();
    formData.append('audio', blob, 'recording.webm');

    this.http.post<{ text: string }>(this.TRANSCRIBE_API, formData).subscribe({
      next: (res) => {
        this.isTranscribing = false;
        if (res.text.trim()) {
          this.userInput = res.text.trim();
          this.lastInputWasVoice = true;
          this.cdr.detectChanges();
          this.send();
        } else {
          this.cdr.detectChanges();
        }
      },
      error: () => {
        this.isTranscribing = false;
        this.cdr.detectChanges();
      },
    });
  }

  speak(text: string) {
    if (!window.speechSynthesis) return;
    this.stopSpeaking();
    const clean = text
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/#{1,6}\s/g, '')
      .replace(/`/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .trim();
    const isMk = this.detectLang(clean) === 'mk-MK';
    const utter = new SpeechSynthesisUtterance(clean);
    utter.lang = isMk ? 'mk-MK' : 'en-US';
    utter.rate = 1;
    utter.voice = this.pickVoice(isMk);
    utter.onstart = () => { this.isSpeaking = true; this.cdr.detectChanges(); };
    utter.onend = () => { this.isSpeaking = false; this.cdr.detectChanges(); };
    utter.onerror = () => { this.isSpeaking = false; this.cdr.detectChanges(); };
    window.speechSynthesis.speak(utter);
  }

  private pickVoice(macedonian: boolean): SpeechSynthesisVoice | null {
    const voices = window.speechSynthesis.getVoices();
    if (macedonian) {
      return voices.find(v => v.lang.startsWith('mk')) ?? null;
    }
    const priority = [
      'Microsoft Aria Online (Natural)',
      'Microsoft Aria',
      'Microsoft Jenny Online (Natural)',
      'Microsoft Jenny',
      'Microsoft Zira',
    ];
    for (const name of priority) {
      const v = voices.find(v => v.name === name);
      if (v) return v;
    }
    return voices.find(v => v.lang.startsWith('en')) ?? null;
  }

  stopSpeaking() {
    if (window.speechSynthesis?.speaking) {
      window.speechSynthesis.cancel();
      this.isSpeaking = false;
    }
  }

  private detectLang(text: string): string {
    const cyrillic = /[Ѐ-ӿ]/;
    return cyrillic.test(text) ? 'mk-MK' : 'en-US';
  }

  clearChat() {
    this.stopSpeaking();
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
