import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { SupportService } from '../../services/support';

@Component({
  selector: 'app-contact-support',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './contact-support.html',
  styleUrls: ['./contact-support.css']
})
export class ContactSupportComponent {
  message = '';
  loading = false;
  success = '';
  error = '';

  constructor(private support: SupportService) {}

  submit() {
    if (!this.message.trim() || this.message.length > 1000) return;
    this.loading = true;
    this.success = '';
    this.error = '';

    this.support.sendMessage(this.message.trim()).subscribe({
      next: () => {
        this.success = 'Your message has been sent to the administrator.';
        this.message = '';
        this.loading = false;
      },
      error: (e: any) => {
        this.error = e.error?.error || 'Failed to send message. Please try again.';
        this.loading = false;
      }
    });
  }
}