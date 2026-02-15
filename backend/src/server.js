const app = require("./app");
const { port } = require("./config");

app.listen(port, () => {
  console.log(`Drone Business API listening on port ${port}`);
});
