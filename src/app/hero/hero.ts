import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Contact } from '../contact/contact';

@Component({
  selector: 'app-hero',
  standalone: true,
  imports: [RouterLink, Contact],
  templateUrl: './hero.html',
  styleUrl: './hero.css',
})
export class Hero {
  scrollToContact(): void {
    const el = document.getElementById('contact');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  }
}

