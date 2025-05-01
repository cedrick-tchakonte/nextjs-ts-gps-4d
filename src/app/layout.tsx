import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GPS 4D collaboratif pour VTOL | PIE ENSTA | Groupe 31",
  description: "Système de navigation 4D en temps réel pour aéronefs VTOL, développé par des étudiants de l’ENSTA Paris avec Cesium et Next.js.",
  openGraph: {
    type: "website",
    siteName: "GPS 4D VTOL - ENSTA",
    title: "GPS 4D collaboratif pour VTOL | Projet étudiant ENSTA",
    url: `https://vtol-gps.ensta.fr`,
    description: "Plateforme collaborative de navigation 4D en temps réel pour appareils VTOL, intégrant CesiumJS et un flux de données en direct.",
    images: [{
      url: ``,
      alt: "Interface du GPS 4D pour VTOL"
    }]
  }
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}