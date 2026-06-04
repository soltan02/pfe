// Top navigation bar.

import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './navbar.html',
  styleUrls: ['./navbar.css']
})
export class NavbarComponent implements OnInit {
  user: any = null;
  menuOpen = false;

  constructor(
    public auth: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.auth.currentUser$.subscribe(u => {
      this.user = u;
      this.cdr.detectChanges();
    });
  }

  toggleMenu() {
    this.menuOpen = !this.menuOpen;
  }

  closeMenu() {
    this.menuOpen = false;
  }

  isAgent(): boolean {
    return this.user?.role === 'agent';
  }

  isChef(): boolean {
    return this.user?.role === 'chef_equipe';
  }

  isAdmin(): boolean {
    return this.user?.role === 'admin';
  }

  isChefOrAdmin(): boolean {
    return this.user?.role === 'chef_equipe' || this.user?.role === 'admin';
  }

  isAgentOrAbove(): boolean {
    return this.user?.role === 'agent' || this.isChefOrAdmin();
  }

  getRoleLabel(): string {
    const roleMap: { [key: string]: string } = {
      'agent': 'Agent',
      'chef_equipe': 'Chef d\'équipe',
      'admin': 'Administrateur'
    };
    return roleMap[this.user?.role] || this.user?.role;
  }
}
