import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import * as L from 'leaflet';
import { SitesService } from '../../services/sites';
import { AuthService } from '../../services/auth';

const iconDefault = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});
L.Marker.prototype.options.icon = iconDefault;

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './map.html'
})
export class MapComponent implements OnInit, OnDestroy {
  sites: any[] = [];
  user: any = null;
  loading = true;
  showStbAgencies = true;
  private mapInitialized = false;
  private map: L.Map | null = null;
  private stbMarkersGroup: L.LayerGroup | null = null;
  private sitesMarkersGroup: L.LayerGroup | null = null;

  private cityCoords: { [key: string]: [number, number] } = {
    'tunis': [36.8190, 10.1657], 'sfax': [34.7406, 10.7603],
    'sousse': [35.8256, 10.6369], 'monastir': [35.7643, 10.8113],
    'nabeul': [36.4561, 10.7376], 'bizerte': [37.2744, 9.8739],
    'kairouan': [35.6712, 10.1005], 'gabes': [33.8814, 10.0982],
    'ariana': [36.8665, 10.1647], 'gafsa': [34.4255, 8.7842],
    'beja': [36.7256, 9.1817], 'jendouba': [36.5011, 8.7803],
    'mahdia': [35.5047, 11.0622], 'tozeur': [33.9197, 8.1335],
    'ben arous': [36.7531, 10.2283], 'manouba': [36.8096, 10.0997],
    'zaghouan': [36.4029, 10.1422], 'siliana': [36.0851, 9.3708],
    'kef': [36.1824, 8.7147], 'kasserine': [35.1721, 8.8306],
    'sidi bouzid': [35.0382, 9.4858], 'medenine': [33.3549, 10.5055],
    'tataouine': [32.9211, 10.4517], 'kebili': [33.7050, 8.9689],
    'default': [36.8190, 10.1657]
  };

  // Real STB agencies per governorate
  private stbAgencies = [
    { nom: 'STB Siege Central', adresse: 'Rue Hedi Nouira', ville: 'Tunis', lat: 36.7992, lng: 10.1761 },
    { nom: 'STB Tunis Lafayette', adresse: 'Avenue de la Liberte', ville: 'Tunis', lat: 36.8362, lng: 10.1772 },
    { nom: 'STB Tunis Bab Bhar', adresse: 'Avenue Habib Bourguiba', ville: 'Tunis', lat: 36.7981, lng: 10.1800 },
    { nom: 'STB Tunis El Menzah', adresse: 'El Menzah 5', ville: 'Tunis', lat: 36.8547, lng: 10.1778 },
    { nom: 'STB Tunis La Marsa', adresse: 'Avenue Taieb Mhiri', ville: 'Tunis', lat: 36.8878, lng: 10.3247 },
    { nom: 'STB Ariana', adresse: 'Avenue Habib Bourguiba', ville: 'Ariana', lat: 36.8625, lng: 10.1956 },
    { nom: 'STB Ben Arous', adresse: 'Centre Urbain', ville: 'Ben Arous', lat: 36.7533, lng: 10.2285 },
    { nom: 'STB Manouba', adresse: 'Cite El Mourouj', ville: 'Manouba', lat: 36.8100, lng: 10.0900 },
    { nom: 'STB Nabeul', adresse: 'Avenue Habib Thameur', ville: 'Nabeul', lat: 36.4534, lng: 10.7346 },
    { nom: 'STB Hammamet', adresse: 'Centre Ville Hammamet', ville: 'Nabeul', lat: 36.4000, lng: 10.6167 },
    { nom: 'STB Bizerte', adresse: 'Avenue Habib Bourguiba', ville: 'Bizerte', lat: 37.2737, lng: 9.8736 },
    { nom: 'STB Zaghouan', adresse: 'Avenue de la Republique', ville: 'Zaghouan', lat: 36.4031, lng: 10.1423 },
    { nom: 'STB Beja', adresse: 'Avenue Habib Bourguiba', ville: 'Beja', lat: 36.7258, lng: 9.1819 },
    { nom: 'STB Jendouba', adresse: 'Avenue Farhat Hached', ville: 'Jendouba', lat: 36.5014, lng: 8.7801 },
    { nom: 'STB Le Kef', adresse: 'Avenue Habib Bourguiba', ville: 'Kef', lat: 36.1826, lng: 8.7148 },
    { nom: 'STB Siliana', adresse: 'Avenue de la Republique', ville: 'Siliana', lat: 36.0853, lng: 9.3710 },
    { nom: 'STB Kairouan', adresse: 'Avenue Ali Zouaoui', ville: 'Kairouan', lat: 35.6745, lng: 10.0982 },
    { nom: 'STB Kasserine', adresse: 'Avenue Habib Bourguiba', ville: 'Kasserine', lat: 35.1723, lng: 8.8308 },
    { nom: 'STB Sidi Bouzid', adresse: 'Avenue Habib Bourguiba', ville: 'Sidi Bouzid', lat: 35.0380, lng: 9.4856 },
    { nom: 'STB Sousse', adresse: 'Boulevard de la Corniche', ville: 'Sousse', lat: 35.8282, lng: 10.6394 },
    { nom: 'STB Sousse Khezama', adresse: 'Khezama Est', ville: 'Sousse', lat: 35.7850, lng: 10.6000 },
    { nom: 'STB Monastir', adresse: 'Avenue de la Republique', ville: 'Monastir', lat: 35.7643, lng: 10.8113 },
    { nom: 'STB Mahdia', adresse: 'Rue Ibn Khaldoun', ville: 'Mahdia', lat: 35.5048, lng: 11.0623 },
    { nom: 'STB Sfax', adresse: 'Avenue Habib Bourguiba', ville: 'Sfax', lat: 34.7400, lng: 10.7600 },
    { nom: 'STB Sfax Chaker', adresse: 'Quartier Chaker', ville: 'Sfax', lat: 34.7592, lng: 10.7613 },
    { nom: 'STB Sfax Sakiet', adresse: 'Sakiet Ezzit', ville: 'Sfax', lat: 34.8000, lng: 10.7500 },
    { nom: 'STB Gabes', adresse: 'Avenue Habib Bourguiba', ville: 'Gabes', lat: 33.8815, lng: 10.0983 },
    { nom: 'STB Medenine', adresse: 'Avenue Habib Bourguiba', ville: 'Medenine', lat: 33.3550, lng: 10.5056 },
    { nom: 'STB Tataouine', adresse: 'Avenue Habib Bourguiba', ville: 'Tataouine', lat: 32.9212, lng: 10.4518 },
    { nom: 'STB Gafsa', adresse: 'Avenue Habib Bourguiba', ville: 'Gafsa', lat: 34.4257, lng: 8.7843 },
    { nom: 'STB Tozeur', adresse: 'Avenue Habib Bourguiba', ville: 'Tozeur', lat: 33.9198, lng: 8.1336 },
    { nom: 'STB Kebili', adresse: 'Avenue de la Republique', ville: 'Kebili', lat: 33.7052, lng: 8.9690 },
  ];

  constructor(
    private sitesService: SitesService,
    private auth: AuthService,
    private cdr: ChangeDetectorRef,
    private router: Router
  ) {}

  ngOnInit() {
    this.auth.currentUser$.subscribe(user => {
      this.user = user;
      this.showStbAgencies = this.isAdmin();
      if (user) {
        this.loadSites();
      }
    });
  }

  private loadSites() {
    this.loading = true;
    const sitesRequest = this.isAdmin()
      ? this.sitesService.getAll()
      : this.sitesService.getMySites();

    sitesRequest.subscribe({
      next: (data) => {
        this.sites = data;
        this.loading = false;
        this.cdr.detectChanges();
        setTimeout(() => {
          if (!this.mapInitialized) {
            this.createMap();
          }
          this.refreshMarkers();
        }, 100);
      },
      error: () => {
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  delete(id: number) {
    if (!confirm('Delete this site?')) return;
    this.sitesService.delete(id).subscribe({
      next: () => this.loadSites(),
      error: () => alert('Error during deletion')
    });
  }

  private createMap() {
    if (this.map) { return; }
    this.mapInitialized = true;
    const el = document.getElementById('stb-map');
    if (!el) return;
    this.map = L.map(el).setView([34.5, 9.0], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: 'OpenStreetMap contributors'
    }).addTo(this.map);

    this.stbMarkersGroup = L.layerGroup().addTo(this.map);
    this.sitesMarkersGroup = L.layerGroup().addTo(this.map);
  }

  private refreshMarkers() {
    if (!this.sitesMarkersGroup || !this.stbMarkersGroup) return;

    this.sitesMarkersGroup.clearLayers();
    this.stbMarkersGroup.clearLayers();

    if (this.isAdmin() && this.showStbAgencies) {
      this.stbAgencies.forEach(agency => {
        const markerHtml = '<div style="background:#0066CC;color:white;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 4px rgba(0,0,0,0.4);border:2px solid white;font-size:11px;font-weight:bold;">S</div>';
        const icon = L.divIcon({ html: markerHtml, iconSize: [24, 24], iconAnchor: [12, 12], className: '' });
        const popup = '<div style="font-family:sans-serif;min-width:180px;"><div style="background:#0066CC;color:white;padding:8px 12px;margin:-12px -12px 8px;border-radius:4px 4px 0 0;font-weight:600;font-size:13px;">' + agency.nom + '</div><div style="padding:4px;font-size:12px;color:#555;"><div style="margin-bottom:3px;">Adresse: ' + agency.adresse + '</div><div>Ville: ' + agency.ville + '</div></div></div>';
        L.marker([agency.lat, agency.lng], { icon }).addTo(this.stbMarkersGroup!).bindPopup(popup);
      });
    } else {
      this.sites.forEach(site => {
        const ville = (site.ville || 'tunis').toLowerCase().trim();
        const coords = this.cityCoords[ville] || this.cityCoords['default'];
        const offsetLat = (Math.random() - 0.5) * 0.03;
        const offsetLng = (Math.random() - 0.5) * 0.03;
        const color = site.statut === 'actif' ? '#1a237e' : '#d32f2f';
        const markerHtml = '<div style="background:' + color + ';border-radius:50% 50% 50% 0;transform:rotate(-45deg);width:36px;height:36px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.4);border:2px solid white;"><span style="transform:rotate(45deg);font-size:11px;font-weight:bold;">STB</span></div>';
        const popup = '<div style="font-family:sans-serif;min-width:180px;"><div style="background:' + color + ';color:white;padding:8px 12px;margin:-12px -12px 8px;border-radius:4px 4px 0 0;font-weight:600;font-size:13px;">' + site.nom + '</div><div style="padding:4px;font-size:12px;color:#555;"><div style="margin-bottom:3px;">Adresse: ' + (site.adresse || 'N/A') + '</div><div style="margin-bottom:3px;">Ville: ' + (site.ville || 'N/A') + '</div><div style="margin-top:6px;"><span style="background:' + (site.statut === 'actif' ? '#e8f5e9' : '#fce4ec') + ';color:' + (site.statut === 'actif' ? '#2e7d32' : '#c62828') + ';padding:2px 8px;border-radius:10px;font-size:11px;">' + site.statut + '</span></div></div></div>';
        const icon = L.divIcon({ html: markerHtml, iconSize: [32, 32], iconAnchor: [16, 32], className: '' });
        L.marker([coords[0] + offsetLat, coords[1] + offsetLng], { icon }).addTo(this.sitesMarkersGroup!).bindPopup(popup);
      });
    }
  }

  toggleStbAgencies() {
    if (!this.isAdmin()) return;
    this.showStbAgencies = !this.showStbAgencies;
    this.refreshMarkers();
    this.cdr.detectChanges();
  }

  isAdmin(): boolean {
    return this.user?.role === 'admin';
  }

  isChef(): boolean {
    return this.user?.role === 'chef_equipe';
  }

  ngOnDestroy() {
    if (this.map) { this.map.remove(); }
  }
}