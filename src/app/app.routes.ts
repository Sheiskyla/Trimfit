import { Routes } from '@angular/router';
import { Hero } from './hero/hero';
import { About } from './about/about';
import { Contact } from './contact/contact';
import { Services } from './services/services';

export const routes: Routes = [
  {path: '', component: Hero},
  {path: 'about', component: About},
  {path: 'contact', component: Contact},
  {path: 'services', component: Services}
];
