import { Component } from '@angular/core';
import { ChatWidgetComponent } from './chat-widget/chat-widget';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [ChatWidgetComponent],
  template: `<app-chat-widget />`,
})
export class App {}
