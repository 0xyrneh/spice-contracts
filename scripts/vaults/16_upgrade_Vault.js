const { ValidationsCacheOutdated } = require("@openzeppelin/hardhat-upgrades/dist/utils");
const hre = require("hardhat");

async function main() {
  const { ethers, upgrades, deployments } = hre;

  // const beacon = await deployments.get("Vault");
  // const Vault = await ethers.getContractFactory("Vault");
  // const vault = await upgrades.upgradeBeacon(beacon.address, Vault, {'timeout': 0});
  // await vault.deployed();
// 
  // console.log("Vault Implementation successfully upgraded!");

  if (hre.network.name !== "localhost" && hre.network.name !== "hardhat") {
    try {
      await hre.run("verify:verify", {
        address: "0x1A228Fb4e23598b3bde807694fa3ee1E0cd22ba0",
        contract: "contracts/vaults/Vault.sol:Vault",
        constructorArguments: [],
      });
    } catch (_) {}
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
