import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { Hero } from './hero/hero';
import { About } from './about/about';
import { Contact } from './contact/contact';
import { Services } from './services/services';
import { SignupComponent } from './signup/signup.component';
import { SigninComponent } from './signin/signin.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { AuthService } from './services/auth.service';

const dashboardGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.waitForAuthState();
  return auth.currentUser ? true : router.createUrlTree(['/signin']);
};

export const routes: Routes = [
  { path: '', component: Hero },
  { path: 'about', component: About },
  { path: 'contact', component: Contact },
  { path: 'services', component: Services },
  { path: 'signup', component: SignupComponent },
  { path: 'signin', component: SigninComponent },
  { path: 'dashboard', component: DashboardComponent, canActivate: [dashboardGuard] }
];



