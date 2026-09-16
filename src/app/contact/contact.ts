import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [FormsModule],
  styleUrl: './contact.css',
  templateUrl: './contact.html',
})
export class Contact {
  formData = {
    name: '',
    email: '',
    phone: '',
    subject: 'General Inquiry',
    message: ''
  };

  onSubmit(): void {
    const name = this.formData.name.trim() || 'Valued Member';
    const email = this.formData.email.trim();
    const phone = this.formData.phone.trim();
    const subject = this.formData.subject.trim();
    const message = this.formData.message.trim();

    const formattedText = `👋 Hello Trimfit Team!\n\n` +
      `👤 *Name:* ${name}\n` +
      (email ? `📧 *Email:* ${email}\n` : '') +
      (phone ? `📞 *Phone:* ${phone}\n` : '') +
      (subject ? `📋 *Subject:* ${subject}\n` : '') +
      `💬 *Message:*\n${message || 'I would like more information about Trimfit programs.'}`;

    const whatsappUrl = `https://wa.me/2349065606081?text=${encodeURIComponent(formattedText)}`;
    window.open(whatsappUrl, '_blank');
  }
}

