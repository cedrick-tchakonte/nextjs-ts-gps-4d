import CesiumWrapper from "../Components/CesiumWrapper"

async function getPosition() {
  //Mimic server-side stuff...
  return {
    position: {
      lat: 39.953436,
      lng: -75.164356
    }
  }
}

async function getWeather() {
  return {
    windSpeed: 15, // Exemple de vitesse du vent
  };
}

export default async function MainPage() {
  const fetchedPosition = await getPosition();
  const currentWeather = await getWeather();

  return (
    <CesiumWrapper
      positions={[fetchedPosition.position]}
      currentWeather={currentWeather}
    />
  );
}