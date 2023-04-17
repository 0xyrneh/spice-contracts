const { ValidationsCacheOutdated } = require("@openzeppelin/hardhat-upgrades/dist/utils");
const hre = require("hardhat");

async function main() {
  const { ethers, upgrades, deployments } = hre;

  const beacon = await deployments.get("VaultBeacon");
  const Vault = await ethers.getContractFactory("Vault");
  const vault = await upgrades.upgradeBeacon(beacon.address, Vault);
  await vault.deployed();

  console.log("Vault Implementation successfully upgraded!");

  if (hre.network.name !== "localhost" && hre.network.name !== "hardhat") {
    try {
      await hre.run("verify:verify", {
        address: "0x3147B737Dc589e7345a16947Dcb58C9E123905D7",
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
