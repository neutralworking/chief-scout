export default function titleScreen() {
  // Create a new scene
  const scene = new Scene("titleScreen");

  // Create a new layer
  const layer = new Layer("titleScreenLayer");

  // Create a new camera
  const camera = new Camera("titleScreenCamera");

  // Create a new entity
  const entity = new Entity("titleScreenEntity");

  // Create a new text component
  const text = new Text("titleScreenText");

  // Set the text component's text
  text.text = "Title Screen";

  // Set the text component's font
  text.font = "Arial";

  // Set the text component's font size
  text.fontSize = 24;

  // Set the text component's color
  text.color = "white";

  // Set the text component's alignment
  text.alignment = "center";

  // Set the text component's position
  text.position = { x: 0, y: 0 };

  // Add the text component to the entity
  entity.addComponent(text);

  // Add the entity to the layer
  layer.addEntity(entity);

  // Add the layer to the scene
  scene.addLayer(layer);

  // Add the camera to the scene
  scene.addCamera(camera);

  // Return the scene
  return scene;
}

