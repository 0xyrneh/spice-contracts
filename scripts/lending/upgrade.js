const hre = require("hardhat");

async function main() {
  const { ethers, upgrades } = hre;

  // const beacon = await deployments.get("SpiceLending");
  // const SpiceLending = await ethers.getContractFactory("SpiceLending");
  // const vault = await upgrades.upgradeBeacon(beacon.address, SpiceLending);
  // await vault.deployed();
// 
  // console.log("SpiceLending successfully upgraded!");

  if (hre.network.name !== "localhost" && hre.network.name !== "hardhat") {
    try {
      await hre.run("verify:verify", {
        address: "0xFE4bF631B64b080b825436831e5294926DF785AB",
        contract: "contracts/lending/SpiceLending.sol:SpiceLending",
        constructorArguments: [],
      });
    } catch (_) {}
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
