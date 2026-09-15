import { AsyncPipe, NgIf } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { Router, RouterOutlet, RouterLink } from '@angular/router';
import { Footer } from './footer/footer';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  imports: [AsyncPipe, NgIf, RouterOutlet, RouterLink, Footer],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  menuOpen = false;

  toggleMenu(): void {
    this.menuOpen = !this.menuOpen;
  }

  closeMenu(): void {
    this.menuOpen = false;
  }
  protected readonly title = signal('Trimfit');

  async logout(): Promise<void> {
    this.closeMenu();
    await this.auth.logout();
    await this.router.navigate(['/']);
  }
}

