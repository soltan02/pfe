import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login';
import { DashboardComponent } from './pages/dashboard/dashboard';
import { AgentListComponent } from './pages/agents/agent-list/agent-list';
import { AgentFormComponent } from './pages/agents/agent-form/agent-form';
import { SiteListComponent } from './pages/sites/site-list/site-list';
import { SiteFormComponent } from './pages/sites/site-form/site-form';
import { AffectationListComponent } from './pages/affectations/affectation-list/affectation-list';
import { MapComponent } from './pages/map/map';
import { AgentAffectationsComponent } from './pages/agent-affectations/agent-affectations';
import { AuthGuard } from './guards/auth-guard';
import { UsersComponent } from './pages/users/users';
import { AgentProfileComponent } from './pages/agent-profile/agent-profile';
import { TeamManagementComponent } from './pages/team-management/team-management';
import { AdminAnalyticsComponent } from './pages/admin-analytics/admin-analytics';
import { PointageComponent } from './pages/pointage/pointage';
import { RapportsComponent } from './pages/rapports/rapports';
import { TicketsComponent } from './pages/tickets/tickets';
import { ChefTicketsComponent } from './pages/chef-tickets/chef-tickets';
import { AdminTicketsComponent } from './pages/admin-tickets/admin-tickets';



export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'dashboard', component: DashboardComponent, canActivate: [AuthGuard] },
  
  // Agent role routes
  { path: 'agent-profile', component: AgentProfileComponent, canActivate: [AuthGuard], data: { allowedRoles: ['agent', 'chef_equipe', 'admin'] } },
  
  // Team Leader role routes
  { path: 'team-management', component: TeamManagementComponent, canActivate: [AuthGuard], data: { allowedRoles: ['chef_equipe', 'admin'] } },
  { path: 'affectations', component: AffectationListComponent, canActivate: [AuthGuard], data: { allowedRoles: ['chef_equipe', 'admin'] } },
  { path: 'pointage', component: PointageComponent, canActivate: [AuthGuard], data: { allowedRoles: ['chef_equipe', 'admin'] } },
  { path: 'rapports', component: RapportsComponent, canActivate: [AuthGuard], data: { allowedRoles: ['chef_equipe', 'admin'] } },
  
  // Chef + Admin routes (chefs can also manage agents now)
  { path: 'agents', component: AgentListComponent, canActivate: [AuthGuard], data: { allowedRoles: ['chef_equipe', 'admin'] } },
  { path: 'agents/new', component: AgentFormComponent, canActivate: [AuthGuard], data: { allowedRoles: ['chef_equipe', 'admin'] } },
  { path: 'agents/edit/:id', component: AgentFormComponent, canActivate: [AuthGuard], data: { allowedRoles: ['chef_equipe', 'admin'] } },
  
  // Admin-only routes
  { path: 'sites', component: SiteListComponent, canActivate: [AuthGuard], data: { allowedRoles: ['admin'] } },
  { path: 'sites/new', component: SiteFormComponent, canActivate: [AuthGuard], data: { allowedRoles: ['admin'] } },
  { path: 'sites/edit/:id', component: SiteFormComponent, canActivate: [AuthGuard], data: { allowedRoles: ['admin'] } },
  { path: 'users', component: UsersComponent, canActivate: [AuthGuard], data: { allowedRoles: ['admin'] } },
  { path: 'admin-analytics', component: AdminAnalyticsComponent, canActivate: [AuthGuard], data: { allowedRoles: ['admin'] } },
  
  // Public routes (for authenticated users)
  { path: 'map', component: MapComponent, canActivate: [AuthGuard] },
  { path: 'mes-affectations', component: AgentAffectationsComponent, canActivate: [AuthGuard] },
  { path: 'tickets', component: TicketsComponent, canActivate: [AuthGuard] },
  { path: 'chef-tickets', component: ChefTicketsComponent, canActivate: [AuthGuard], data: { allowedRoles: ['chef_equipe', 'admin'] } },
  { path: 'admin-tickets', component: AdminTicketsComponent, canActivate: [AuthGuard], data: { allowedRoles: ['admin'] } },
  
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' }
];