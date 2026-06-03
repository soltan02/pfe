import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './components/navbar/navbar';
import { AuthService } from './services/auth';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent],
  template: `
    <app-navbar></app-navbar>
    <router-outlet></router-outlet>
  `
})
export class AppComponent implements OnInit {
  title = 'frontend';
  constructor(private auth: AuthService) {}
  ngOnInit() {
    if (this.auth.getToken()) {
      this.auth.fetchMe();
    }
  }
}