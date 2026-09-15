import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface CloudinaryUploadResponse {
  secure_url: string;
  public_id: string;
  format: string;
  width: number;
  height: number;
  created_at: string;
}

@Injectable({
  providedIn: 'root'
})
export class CloudinaryService {
  private http = inject(HttpClient);

  // Configuration - Replace the preset with your Cloudinary unsigned upload preset
  private cloudName = 'dvevtbnmp';
  private uploadPreset = 'docs_upload_example_preset'; // Replace with your unsigned upload preset

  /**
   * Set your custom Cloudinary Cloud Name and Unsigned Upload Preset
   */
  configure(cloudName: string, uploadPreset: string): void {
    this.cloudName = cloudName;
    this.uploadPreset = uploadPreset;
  }

  /**
   * Direct Unsigned Image Upload to Cloudinary from Angular Frontend
   */
  uploadImage(file: File): Observable<CloudinaryUploadResponse> {
    const url = `https://api.cloudinary.com/v1_1/${this.cloudName}/image/upload`;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', this.uploadPreset);

    return this.http.post<CloudinaryUploadResponse>(url, formData);
  }
}
