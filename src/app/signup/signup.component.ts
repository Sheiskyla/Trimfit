import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './signup.component.html',
  styleUrl: './signup.component.scss'
})
export class SignupComponent {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private auth = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);

  signupForm: FormGroup;
  showPassword = false;
  showConfirmPassword = false;
  isSubmitting = false;
  submitSuccess = false;
  authError = '';

  constructor() {
    this.signupForm = this.fb.group({
      fullName: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      password: [
        '',
        [
          Validators.required,
          Validators.minLength(8),
          Validators.pattern(/^(?=.*[A-Z])(?=.*\d).*$/)
        ]
      ],
      confirmPassword: ['', [Validators.required]],
      agreeTerms: [false, [Validators.requiredTrue]]
    }, { validators: this.passwordMatchValidator });
  }

  private passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password')?.value;
    const confirmPassword = control.get('confirmPassword')?.value;
    if (password && confirmPassword && password !== confirmPassword) {
      control.get('confirmPassword')?.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    }
    if (control.get('confirmPassword')?.hasError('passwordMismatch')) {
      const errors = { ...control.get('confirmPassword')?.errors };
      delete errors['passwordMismatch'];
      const hasOtherErrors = Object.keys(errors).length > 0;
      control.get('confirmPassword')?.setErrors(hasOtherErrors ? errors : null);
    }
    return null;
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  get fullNameControl() { return this.signupForm.get('fullName'); }
  get emailControl() { return this.signupForm.get('email'); }
  get passwordControl() { return this.signupForm.get('password'); }
  get confirmPasswordControl() { return this.signupForm.get('confirmPassword'); }
  get agreeTermsControl() { return this.signupForm.get('agreeTerms'); }

  get hasMinLength(): boolean {
    const val = this.passwordControl?.value || '';
    return val.length >= 8;
  }

  get hasCapitalLetter(): boolean {
    const val = this.passwordControl?.value || '';
    return /[A-Z]/.test(val);
  }

  get hasNumber(): boolean {
    const val = this.passwordControl?.value || '';
    return /\d/.test(val);
  }

  get passwordStrengthScore(): number {
    const val = this.passwordControl?.value || '';
    if (!val) return 0;
    let score = 0;
    if (val.length >= 8) score += 34;
    if (/[A-Z]/.test(val)) score += 33;
    if (/\d/.test(val)) score += 33;
    return score;
  }

  get passwordStrengthLabel(): string {
    const score = this.passwordStrengthScore;
    if (score === 0) return '';
    if (score <= 34) return 'Weak';
    if (score <= 67) return 'Medium';
    return 'Strong';
  }

  get passwordStrengthColor(): string {
    const score = this.passwordStrengthScore;
    if (score <= 34) return '#ef4444';
    if (score <= 67) return '#f59e0b';
    return '#ccff00';
  }

  onSocialAuth(provider: string): void {
    alert(`Signing up with ${provider}... (Simulated Social Auth)`);
  }

  async onSubmit(): Promise<void> {
    if (this.signupForm.invalid || this.isSubmitting) {
      this.signupForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    this.authError = '';
    this.submitSuccess = false;
    this.cdr.detectChanges();

    try {
      await this.auth.signUp(
        this.emailControl?.value,
        this.passwordControl?.value,
        this.fullNameControl?.value
      );
      this.submitSuccess = true;
      this.cdr.detectChanges();
      setTimeout(() => {
        this.router.navigate(['/signin']);
      }, 1000);
    } catch (error: any) {
      if (error?.code === 'auth/email-already-in-use') {
        this.authError = 'An account already exists for this email address.';
      } else if (error?.code === 'auth/timeout') {
        this.authError = 'Account creation timed out. Check your connection and try again.';
      } else {
        this.authError = error?.message || 'We could not create your account. Please try again.';
      }
    } finally {
      this.isSubmitting = false;
      this.cdr.detectChanges();
    }
  }
}
