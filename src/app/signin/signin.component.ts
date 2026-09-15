import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-signin',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterLink],
  templateUrl: './signin.component.html',
  styleUrl: './signin.component.scss'
})
export class SigninComponent {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private auth = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);

  signinForm: FormGroup;
  showPassword = false;
  isSubmitting = false;
  submitSuccess = false;
  forgotPasswordSent = false;
  showForgotModal = false;
  forgotEmail = '';
  authError = '';
  private authRequestActive = false;

  constructor() {
    this.signinForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]],
      rememberMe: [true]
    });
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  get emailControl() { return this.signinForm.get('email'); }
  get passwordControl() { return this.signinForm.get('password'); }

  onSocialAuth(provider: string): void {
    alert(`Signing in with ${provider}... (Simulated Social Auth)`);
  }

  openForgotPasswordModal(): void {
    this.showForgotModal = true;
    this.forgotEmail = this.emailControl?.value || '';
    this.forgotPasswordSent = false;
  }

  closeForgotPasswordModal(): void {
    this.showForgotModal = false;
  }

  sendPasswordReset(): void {
    if (!this.forgotEmail || !this.forgotEmail.includes('@')) {
      alert('Please enter a valid email address for password reset.');
      return;
    }
    this.auth.resetPassword(this.forgotEmail)
      .then(() => {
        this.forgotPasswordSent = true;
        setTimeout(() => this.closeForgotPasswordModal(), 2000);
      })
      .catch(() => alert('Unable to send the reset email. Please check the address and try again.'));
  }

  onSubmit(): void {
    if (this.signinForm.invalid || this.authRequestActive) {
      this.signinForm.markAllAsTouched();
      return;
    }

    this.authRequestActive = true;
    this.authError = '';
    this.submitSuccess = false;

    const email = String(this.emailControl?.value || '').trim().toLowerCase();
    const password = String(this.passwordControl?.value || '');

    this.auth.signIn(email, password)
      .then(() => {
        this.submitSuccess = true;
        setTimeout(() => {
          this.router.navigate(['/dashboard']);
        }, 1000);
      })
      .catch((error: { code?: string; message?: string }) => {
        this.authError = this.getAuthErrorMessage(error.code, error.message);
        this.cdr.detectChanges();
      })
      .finally(() => {
        this.authRequestActive = false;
        this.cdr.detectChanges();
      });
  }

  private getAuthErrorMessage(code?: string, message?: string): string {
    switch (code) {
      case 'auth/user-not-found':
        return 'Account not found. Please sign up first.';
      case 'auth/wrong-password':
        return 'Invalid password. Please check your password and try again.';
      case 'auth/invalid-credential':
        return 'Account not found or credentials are invalid. Please sign up first.';
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/too-many-requests':
        return 'Too many failed attempts. Please wait a moment and try again.';
      case 'auth/timeout':
        return 'Sign-in timed out. This account was not authenticated. Check your connection and try again.';
      default:
        return message || 'Account not found. Please sign up first.';
    }
  }
}
