import qwenService from "./services/qwenService";

async function runTest() {
  console.log("Testing Qwen Connection...");
  
  const result = await qwenService.testQwenConnection();
  
  console.log("Connection Result:", result);

  if (result.success) {
    console.log("✅ Qwen is successfully integrated with Node.js!");
  } else {
    console.log("❌ Connection failed!");
  }
}

runTest();