const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { takeSnapshot, revertToSnapshot } = require("../helpers/snapshot");
const { impersonateAccount } = require("../helpers/account");
const constants = require("../constants");

describe("SpiceFiNFT4626", function () {
  // tokens
  let token;
  let weth;

  // vaults
  let vault;
  let bend;
  let drops;
  let spiceVault;

  // accounts
  let admin, alice, bob, carol, strategist, spiceAdmin, signer, treasury;
  let whale, dev;

  // snapshot ID
  let snapshotId;

  // roles
  let defaultAdminRole,
    strategistRole,
    vaultRole,
    assetReceiverRole,
    spiceRole,
    creatorRole;

  // constants
  const vaultName = "Spice Vault Test Token";
  const vaultSymbol = "svTT";
  const bendVaultName = "Spice interest bearing WETH";
  const bendVaultSymbol = "spiceETH";
  const dropsVaultName = "Spice CEther";
  const dropsVaultSymbol = "SCEther";
  const spiceVaultName = "Spice0";
  const spiceVaultSymbol = "s0";
  const mintPrice = ethers.utils.parseEther("0.08");
  const maxSupply = 3;

  async function deployTokenAndAirdrop(users, amount) {
    const Token = await ethers.getContractFactory("TestERC20");
    const token = await Token.deploy("TestToken", "TT");

    for (let i = 0; i < users.length; i++) {
      await token.mint(users[i].address, amount);
    }

    return token;
  }

  async function checkRole(contract, user, role, check) {
    expect(await contract.hasRole(role, user)).to.equal(check);
  }

  async function depositToVaults(vaults, amounts) {
    for (let i = 0; i < vaults.length; i++) {
      await spiceVault
        .connect(strategist)
        ["deposit(address,uint256,uint256)"](vaults[i], amounts[i], 0);
    }
  }

  before("Deploy", async function () {
    [admin, alice, bob, carol, strategist, spiceAdmin, signer, treasury] =
      await ethers.getSigners();

    await alice.sendTransaction({
      to: constants.accounts.Dev,
      value: ethers.utils.parseEther("10"),
    });

    await impersonateAccount(constants.accounts.Whale);
    whale = await ethers.getSigner(constants.accounts.Whale);
    await impersonateAccount(constants.accounts.Dev);
    dev = await ethers.getSigner(constants.accounts.Dev);

    const amount = ethers.utils.parseEther("1000000");
    token = await deployTokenAndAirdrop([admin, alice, bob, carol], amount);
    weth = await ethers.getContractAt(
      "TestERC20",
      constants.tokens.WETH,
      admin
    );

    const Vault = await ethers.getContractFactory("Vault");
    let beacon = await upgrades.deployBeacon(Vault);

    vault = await upgrades.deployBeaconProxy(beacon, Vault, [
      vaultName,
      vaultSymbol,
      weth.address,
      [],
      admin.address,
      constants.accounts.Dev,
      constants.accounts.Multisig,
      treasury.address,
    ]);

    const Bend4626 = await ethers.getContractFactory("Bend4626");
    beacon = await upgrades.deployBeacon(Bend4626);

    bend = await upgrades.deployBeaconProxy(beacon, Bend4626, [
      bendVaultName,
      bendVaultSymbol,
      constants.contracts.BendPool,
      constants.tokens.BendWETH,
    ]);

    const Drops4626 = await ethers.getContractFactory("Drops4626");
    beacon = await upgrades.deployBeacon(Drops4626);

    drops = await upgrades.deployBeaconProxy(beacon, Drops4626, [
      dropsVaultName,
      dropsVaultSymbol,
      constants.tokens.DropsETH,
    ]);

    const SpiceFiNFT4626 = await ethers.getContractFactory("SpiceFiNFT4626");
    beacon = await upgrades.deployBeacon(SpiceFiNFT4626, {
      unsafeAllow: ["delegatecall"],
    });

    await expect(
      upgrades.deployBeaconProxy(beacon, SpiceFiNFT4626, [
        spiceVaultName,
        spiceVaultSymbol,
        ethers.constants.AddressZero,
        mintPrice,
        maxSupply,
        [vault.address, bend.address, drops.address],
        admin.address,
        constants.accounts.Dev,
        constants.accounts.Multisig,
        treasury.address,
      ])
    ).to.be.revertedWithCustomError(SpiceFiNFT4626, "InvalidAddress");
    await expect(
      upgrades.deployBeaconProxy(beacon, SpiceFiNFT4626, [
        spiceVaultName,
        spiceVaultSymbol,
        weth.address,
        mintPrice,
        0,
        [vault.address, bend.address, drops.address],
        admin.address,
        constants.accounts.Dev,
        constants.accounts.Multisig,
        treasury.address,
      ])
    ).to.be.revertedWithCustomError(SpiceFiNFT4626, "ParameterOutOfBounds");
    await expect(
      upgrades.deployBeaconProxy(beacon, SpiceFiNFT4626, [
        spiceVaultName,
        spiceVaultSymbol,
        weth.address,
        mintPrice,
        maxSupply,
        [vault.address, bend.address, ethers.constants.AddressZero],
        admin.address,
        constants.accounts.Dev,
        constants.accounts.Multisig,
        treasury.address,
      ])
    ).to.be.revertedWithCustomError(SpiceFiNFT4626, "InvalidAddress");
    await expect(
      upgrades.deployBeaconProxy(beacon, SpiceFiNFT4626, [
        spiceVaultName,
        spiceVaultSymbol,
        weth.address,
        mintPrice,
        maxSupply,
        [vault.address, bend.address, drops.address],
        ethers.constants.AddressZero,
        constants.accounts.Dev,
        constants.accounts.Multisig,
        treasury.address,
      ])
    ).to.be.revertedWithCustomError(SpiceFiNFT4626, "InvalidAddress");
    await expect(
      upgrades.deployBeaconProxy(beacon, SpiceFiNFT4626, [
        spiceVaultName,
        spiceVaultSymbol,
        weth.address,
        mintPrice,
        maxSupply,
        [vault.address, bend.address, drops.address],
        admin.address,
        ethers.constants.AddressZero,
        constants.accounts.Multisig,
        treasury.address,
      ])
    ).to.be.revertedWithCustomError(SpiceFiNFT4626, "InvalidAddress");
    await expect(
      upgrades.deployBeaconProxy(beacon, SpiceFiNFT4626, [
        spiceVaultName,
        spiceVaultSymbol,
        weth.address,
        mintPrice,
        maxSupply,
        [vault.address, bend.address, drops.address],
        admin.address,
        constants.accounts.Dev,
        ethers.constants.AddressZero,
        treasury.address,
      ])
    ).to.be.revertedWithCustomError(SpiceFiNFT4626, "InvalidAddress");
    await expect(
      upgrades.deployBeaconProxy(beacon, SpiceFiNFT4626, [
        spiceVaultName,
        spiceVaultSymbol,
        weth.address,
        mintPrice,
        maxSupply,
        [vault.address, bend.address, drops.address],
        admin.address,
        constants.accounts.Dev,
        constants.accounts.Multisig,
        ethers.constants.AddressZero,
      ])
    ).to.be.revertedWithCustomError(SpiceFiNFT4626, "InvalidAddress");

    spiceVault = await upgrades.deployBeaconProxy(beacon, SpiceFiNFT4626, [
      spiceVaultName,
      spiceVaultSymbol,
      weth.address,
      mintPrice,
      maxSupply,
      [vault.address, bend.address, drops.address],
      admin.address,
      constants.accounts.Dev,
      constants.accounts.Multisig,
      treasury.address,
    ]);

    defaultAdminRole = await spiceVault.DEFAULT_ADMIN_ROLE();
    strategistRole = await spiceVault.STRATEGIST_ROLE();
    vaultRole = await spiceVault.VAULT_ROLE();
    assetReceiverRole = await spiceVault.ASSET_RECEIVER_ROLE();
    spiceRole = await spiceVault.SPICE_ROLE();
    creatorRole = await spiceVault.CREATOR_ROLE();

    await spiceVault.connect(dev).grantRole(strategistRole, strategist.address);
    await spiceVault.connect(dev).grantRole(vaultRole, vault.address);
    await spiceVault.connect(dev).grantRole(vaultRole, bend.address);
    await spiceVault.connect(dev).grantRole(vaultRole, drops.address);
    await checkRole(spiceVault, strategist.address, strategistRole, true);
    await checkRole(spiceVault, vault.address, vaultRole, true);
    await checkRole(spiceVault, bend.address, vaultRole, true);
    await checkRole(spiceVault, drops.address, vaultRole, true);

    await spiceVault.connect(dev).grantRole(spiceRole, spiceAdmin.address);
    await checkRole(spiceVault, spiceAdmin.address, spiceRole, true);

    await spiceVault.connect(dev).grantRole(defaultAdminRole, admin.address);

    await spiceVault.connect(dev).setWithdrawalFees(700);
  });

  beforeEach(async () => {
    snapshotId = await takeSnapshot();
  });

  afterEach(async function () {
    await revertToSnapshot(snapshotId);
  });

  describe("Deployment", function () {
    it("Should set the correct name", async function () {
      expect(await spiceVault.name()).to.equal(spiceVaultName);
    });

    it("Should set the correct symbol", async function () {
      expect(await spiceVault.symbol()).to.equal(spiceVaultSymbol);
    });

    it("Should set the correct asset", async function () {
      expect(await spiceVault.asset()).to.equal(weth.address);
    });

    it("Should set the correct role", async function () {
      await checkRole(spiceVault, admin.address, defaultAdminRole, true);
      await checkRole(
        spiceVault,
        constants.accounts.Multisig,
        defaultAdminRole,
        true
      );
      await checkRole(
        spiceVault,
        constants.accounts.Dev,
        defaultAdminRole,
        true
      );
      await checkRole(spiceVault, admin.address, creatorRole, true);
      await checkRole(spiceVault, constants.accounts.Dev, strategistRole, true);
      await checkRole(
        spiceVault,
        constants.accounts.Multisig,
        assetReceiverRole,
        true
      );
      await checkRole(spiceVault, constants.accounts.Multisig, spiceRole, true);
    });

    it("Should initialize once", async function () {
      await expect(
        spiceVault.initialize(
          spiceVaultName,
          spiceVaultSymbol,
          weth.address,
          mintPrice,
          maxSupply,
          [vault.address, bend.address, drops.address],
          admin.address,
          constants.accounts.Dev,
          constants.accounts.Multisig,
          treasury.address
        )
      ).to.be.revertedWith("Initializable: contract is already initialized");
    });
  });

  describe("Getters", function () {
    describe("convertToShares", function () {
      it("Zero assets", async function () {
        expect(await spiceVault.convertToShares(0)).to.be.eq(0);
      });

      it("Non-zero assets when supply is zero", async function () {
        const assets = ethers.utils.parseEther("100");
        expect(await spiceVault.convertToShares(assets)).to.be.eq(assets);
      });

      it("Non-zero assets when supply is non-zero", async function () {
        const assets = ethers.utils.parseEther("100");
        await weth
          .connect(whale)
          .approve(spiceVault.address, ethers.constants.MaxUint256);
        await spiceVault.connect(whale)["deposit(uint256,uint256)"](0, assets);

        expect(await spiceVault.convertToShares(100)).to.be.eq(100);
      });
    });

    describe("convertToAssets", function () {
      it("Zero shares", async function () {
        expect(await spiceVault.convertToAssets(0)).to.be.eq(0);
      });

      it("Non-zero shares when supply is zero", async function () {
        expect(await spiceVault.convertToAssets(100)).to.be.eq(100);
      });

      it("Non-zero shares when supply is non-zero", async function () {
        const assets = ethers.utils.parseEther("100");
        await weth
          .connect(whale)
          .approve(spiceVault.address, ethers.constants.MaxUint256);
        await spiceVault.connect(whale)["deposit(uint256,uint256)"](0, assets);

        expect(await spiceVault.convertToAssets(100)).to.be.eq(100);
      });
    });

    describe("previewDeposit", function () {
      it("Zero assets", async function () {
        expect(await spiceVault.previewDeposit(0)).to.be.eq(0);
      });

      it("Non-zero assets when supply is zero", async function () {
        expect(await spiceVault.previewDeposit(100)).to.be.eq(100);
      });

      it("Non-zero assets when supply is non-zero", async function () {
        const assets = ethers.utils.parseEther("100");
        await weth
          .connect(whale)
          .approve(spiceVault.address, ethers.constants.MaxUint256);
        await spiceVault.connect(whale)["deposit(uint256,uint256)"](0, assets);

        expect(await spiceVault.previewDeposit(100)).to.be.eq(100);
      });
    });

    describe("previewMint", function () {
      it("Zero shares", async function () {
        expect(await spiceVault.previewMint(0)).to.be.eq(0);
      });

      it("Non-zero shares when supply is zero", async function () {
        expect(await spiceVault.previewMint(100)).to.be.eq(100);
      });

      it("Non-zero shares when supply is non-zero", async function () {
        const assets = ethers.utils.parseEther("100");
        await weth
          .connect(whale)
          .approve(spiceVault.address, ethers.constants.MaxUint256);
        await spiceVault.connect(whale)["deposit(uint256,uint256)"](0, assets);

        expect(await spiceVault.previewMint(100)).to.be.eq(100);
      });
    });

    describe("previewWithdraw", function () {
      it("Zero assets", async function () {
        expect(await spiceVault.previewWithdraw(0)).to.be.eq(0);
      });

      it("Non-zero assets when supply is zero", async function () {
        expect(await spiceVault.previewWithdraw(10000)).to.be.eq(10000);
      });

      it("Non-zero assets when supply is non-zero", async function () {
        const assets = ethers.utils.parseEther("100");
        await weth
          .connect(whale)
          .approve(spiceVault.address, ethers.constants.MaxUint256);
        await spiceVault.connect(whale)["deposit(uint256,uint256)"](0, assets);

        expect(await spiceVault.previewWithdraw(10000)).to.be.eq(10000);
      });

      it("Consider interest fees", async function () {
        const amount = ethers.utils.parseEther("100");
        await weth
          .connect(whale)
          .approve(spiceVault.address, ethers.constants.MaxUint256);
        await spiceVault.connect(whale)["deposit(uint256,uint256)"](0, amount.add(mintPrice));

        const interest = ethers.utils.parseEther("10");
        const fees = interest.mul(700).div(10000);
        await weth.connect(whale).transfer(spiceVault.address, interest);

        expect(await spiceVault.previewWithdraw(amount)).to.be.closeTo(amount.mul(amount).div(amount.add(interest).sub(fees)), 1);
      });
    });

    describe("previewRedeem", function () {
      it("Zero shares", async function () {
        expect(await spiceVault.previewRedeem(0)).to.be.eq(0);
      });

      it("Non-zero shares when supply is zero", async function () {
        expect(await spiceVault.previewRedeem(10000)).to.be.eq(10000);
      });

      it("Non-zero shares when supply is non-zero", async function () {
        const assets = ethers.utils.parseEther("100");
        await weth
          .connect(whale)
          .approve(spiceVault.address, ethers.constants.MaxUint256);
        await spiceVault.connect(whale)["deposit(uint256,uint256)"](0, assets);

        expect(await spiceVault.previewRedeem(10000)).to.be.eq(10000);
      });

      it("Consider interest fees", async function () {
        const amount = ethers.utils.parseEther("100");
        await weth
          .connect(whale)
          .approve(spiceVault.address, ethers.constants.MaxUint256);
        await spiceVault.connect(whale)["deposit(uint256,uint256)"](0, amount.add(mintPrice));

        const interest = ethers.utils.parseEther("10");
        const fees = interest.mul(700).div(10000);
        await weth.connect(whale).transfer(spiceVault.address, interest);

        expect(await spiceVault.previewRedeem(amount)).to.be.closeTo(amount.mul(amount.add(interest).sub(fees)).div(amount), 1);
      });
    });

    describe("maxDeposit", function () {
      it("When paused", async function () {
        await spiceVault.pause();
        expect(await spiceVault.maxDeposit(admin.address)).to.be.eq(0);
      });

      it("When not paused", async function () {
        expect(await spiceVault.maxDeposit(admin.address)).to.be.eq(
          ethers.constants.MaxUint256
        );
      });
    });

    describe("maxMint", function () {
      it("When paused", async function () {
        await spiceVault.pause();
        expect(await spiceVault.maxMint(admin.address)).to.be.eq(0);
      });

      it("When not paused", async function () {
        expect(await spiceVault.maxMint(admin.address)).to.be.eq(
          ethers.constants.MaxUint256
        );
      });
    });

    describe("maxWithdraw", function () {
      it("When paused", async function () {
        await spiceVault.pause();
        expect(await spiceVault.maxWithdraw(admin.address)).to.be.eq(0);
      });

      it("When balance is zero", async function () {
        expect(await spiceVault.maxWithdraw(admin.address)).to.be.eq(0);
      });

      it("When balance is non-zero", async function () {
        const assets = ethers.utils.parseEther("100");
        await weth
          .connect(whale)
          .approve(spiceVault.address, ethers.constants.MaxUint256);
        await spiceVault.connect(whale)["deposit(uint256,uint256)"](0, assets.add(mintPrice));

        expect(await spiceVault.maxWithdraw(whale.address)).to.be.eq(
          assets.mul(10000).div(10000)
        );
      });
    });

    describe("maxRedeem", function () {
      it("When paused", async function () {
        await spiceVault.pause();
        expect(await spiceVault.maxRedeem(admin.address)).to.be.eq(0);
      });

      it("When balance is zero", async function () {
        expect(await spiceVault.maxRedeem(admin.address)).to.be.eq(0);
      });

      it("When balance is non-zero", async function () {
        const assets = ethers.utils.parseEther("100");
        await weth
          .connect(whale)
          .approve(spiceVault.address, ethers.constants.MaxUint256);
        await spiceVault.connect(whale)["deposit(uint256,uint256)"](0, assets.add(mintPrice));

        expect(await spiceVault.maxRedeem(whale.address)).to.be.eq(
          assets.mul(10000).div(10000)
        );
      });
    });

    describe("tokenURI", function () {
      it("When token not exists", async function () {
        await expect(spiceVault.tokenURI(1)).to.be.revertedWith(
          "ERC721: invalid token ID"
        );
      });

      it("When not revealed", async function () {
        await spiceVault.setPreviewURI("previewuri/");
        const amount = ethers.utils.parseEther("100");
        await weth
          .connect(whale)
          .approve(spiceVault.address, ethers.constants.MaxUint256);
        await spiceVault.connect(whale)["deposit(uint256,uint256)"](0, amount);

        expect(await spiceVault.tokenURI(1)).to.be.eq("previewuri/1");
      });

      it("When base uri is empty", async function () {
        await spiceVault.setBaseURI("");
        const amount = ethers.utils.parseEther("100");
        await weth
          .connect(whale)
          .approve(spiceVault.address, ethers.constants.MaxUint256);
        await spiceVault.connect(whale)["deposit(uint256,uint256)"](0, amount);

        expect(await spiceVault.tokenURI(1)).to.be.eq("");
      });

      it("When base uri is not empty", async function () {
        await spiceVault.setBaseURI("baseuri://");
        const amount = ethers.utils.parseEther("100");
        await weth
          .connect(whale)
          .approve(spiceVault.address, ethers.constants.MaxUint256);
        await spiceVault.connect(whale)["deposit(uint256,uint256)"](0, amount);

        expect(await spiceVault.tokenURI(1)).to.be.eq("baseuri://1");
      });
    });
  });

  describe("User Actions", function () {
    describe("Deposit", function () {
      it("When paused", async function () {
        await spiceVault.pause();

        const amount = ethers.utils.parseEther("100");
        await weth
          .connect(whale)
          .approve(spiceVault.address, ethers.constants.MaxUint256);

        await expect(
          spiceVault.connect(whale)["deposit(uint256,uint256)"](0, amount)
        ).to.be.revertedWith("Pausable: paused");
      });

      it("Should not deposit 0 amounts", async function () {
        await expect(
          spiceVault.connect(whale)["deposit(uint256,uint256)"](0, 0)
        ).to.be.revertedWithCustomError(spiceVault, "ParameterOutOfBounds");
      });

      it("Mint new NFT and deposit", async function () {
        const amount = ethers.utils.parseEther("100");
        await weth
          .connect(whale)
          .approve(spiceVault.address, ethers.constants.MaxUint256);

        const beforeBalance = await weth.balanceOf(whale.address);

        const tx = await spiceVault
          .connect(whale)
          ["deposit(uint256,uint256)"](0, amount.add(mintPrice));

        expect(await spiceVault.ownerOf(1)).to.be.eq(whale.address);
        expect(await weth.balanceOf(whale.address)).to.be.eq(
          beforeBalance.sub(amount).sub(mintPrice)
        );
        await expect(tx)
          .to.emit(spiceVault, "Deposit")
          .withArgs(whale.address, 1, amount, amount);
      });

      it("Can't mint twice on same wallet", async function () {
        const amount = ethers.utils.parseEther("100");
        await weth
          .connect(whale)
          .approve(spiceVault.address, ethers.constants.MaxUint256);

        await spiceVault.connect(whale)["deposit(uint256,uint256)"](0, amount);

        await expect(
          spiceVault.connect(whale)["deposit(uint256,uint256)"](0, amount)
        ).to.be.revertedWithCustomError(spiceVault, "MoreThanOne");
      });

      it("Can't mint more than maxSupply", async function () {
        await weth
          .connect(alice)
          .approve(spiceVault.address, ethers.constants.MaxUint256);
        await weth
          .connect(bob)
          .approve(spiceVault.address, ethers.constants.MaxUint256);
        await weth
          .connect(carol)
          .approve(spiceVault.address, ethers.constants.MaxUint256);
        await weth
          .connect(whale)
          .approve(spiceVault.address, ethers.constants.MaxUint256);

        const amount = ethers.utils.parseEther("10");
        await weth.connect(whale).transfer(alice.address, amount.mul(2));
        await weth.connect(whale).transfer(bob.address, amount.mul(2));
        await weth.connect(whale).transfer(carol.address, amount.mul(2));

        await spiceVault.connect(alice)["deposit(uint256,uint256)"](0, amount);
        await spiceVault.connect(bob)["deposit(uint256,uint256)"](0, amount);
        await spiceVault.connect(carol)["deposit(uint256,uint256)"](0, amount);
        await expect(
          spiceVault.connect(whale)["deposit(uint256,uint256)"](0, amount)
        ).to.be.revertedWithCustomError(spiceVault, "OutOfSupply");
      });

      it("When not owning NFT", async function () {
        const amount = ethers.utils.parseEther("10");
        await weth
          .connect(whale)
          .approve(spiceVault.address, ethers.constants.MaxUint256);

        await spiceVault.connect(whale)["deposit(uint256,uint256)"](0, amount);

        await spiceVault
          .connect(whale)
          ["safeTransferFrom(address,address,uint256)"](
            whale.address,
            alice.address,
            1
          );

        await expect(
          spiceVault.connect(whale)["deposit(uint256,uint256)"](1, amount)
        ).to.be.revertedWithCustomError(spiceVault, "InvalidTokenId");
      });

      it("Deposit using NFT", async function () {
        const amount = ethers.utils.parseEther("10");
        await weth
          .connect(whale)
          .approve(spiceVault.address, ethers.constants.MaxUint256);

        await spiceVault.connect(whale)["deposit(uint256,uint256)"](0, amount.add(mintPrice));

        const beforeBalance = await weth.balanceOf(whale.address);

        const tx = await spiceVault
          .connect(whale)
          ["deposit(uint256,uint256)"](1, amount);

        expect(await weth.balanceOf(whale.address)).to.be.eq(
          beforeBalance.sub(amount)
        );
        await expect(tx)
          .to.emit(spiceVault, "Deposit")
          .withArgs(whale.address, 1, amount, amount);
      });
    });

    describe("Mint", function () {
      it("When paused", async function () {
        await spiceVault.pause();

        const amount = ethers.utils.parseEther("100");
        await weth
          .connect(whale)
          .approve(spiceVault.address, ethers.constants.MaxUint256);

        await expect(
          spiceVault.connect(whale)["mint(uint256,uint256)"](0, amount)
        ).to.be.revertedWith("Pausable: paused");
      });

      it("Should not deposit 0 amounts", async function () {
        await expect(
          spiceVault.connect(whale)["deposit(uint256,uint256)"](0, 0)
        ).to.be.revertedWithCustomError(spiceVault, "ParameterOutOfBounds");
      });

      it("Mint new NFT and deposit", async function () {
        const amount = ethers.utils.parseEther("100");
        await weth
          .connect(whale)
          .approve(spiceVault.address, ethers.constants.MaxUint256);

        const beforeBalance = await weth.balanceOf(whale.address);

        const tx = await spiceVault
          .connect(whale)
          ["mint(uint256,uint256)"](0, amount);

        expect(await spiceVault.ownerOf(1)).to.be.eq(whale.address);
        expect(await weth.balanceOf(whale.address)).to.be.eq(
          beforeBalance.sub(amount).sub(mintPrice)
        );
        await expect(tx)
          .to.emit(spiceVault, "Deposit")
          .withArgs(whale.address, 1, amount, amount);
      });

      it("Can't mint twice on same wallet", async function () {
        const amount = ethers.utils.parseEther("100");
        await weth
          .connect(whale)
          .approve(spiceVault.address, ethers.constants.MaxUint256);

        await spiceVault.connect(whale)["mint(uint256,uint256)"](0, amount);

        await expect(
          spiceVault.connect(whale)["mint(uint256,uint256)"](0, amount)
        ).to.be.revertedWithCustomError(spiceVault, "MoreThanOne");
      });

      it("When not owning NFT", async function () {
        const amount = ethers.utils.parseEther("10");
        await weth
          .connect(whale)
          .approve(spiceVault.address, ethers.constants.MaxUint256);

        await spiceVault.connect(whale)["mint(uint256,uint256)"](0, amount);

        await spiceVault
          .connect(whale)
          ["safeTransferFrom(address,address,uint256)"](
            whale.address,
            alice.address,
            1
          );

        await expect(
          spiceVault.connect(whale)["mint(uint256,uint256)"](1, amount)
        ).to.be.revertedWithCustomError(spiceVault, "InvalidTokenId");
      });

      it("Deposit using NFT", async function () {
        const amount = ethers.utils.parseEther("10");
        await weth
          .connect(whale)
          .approve(spiceVault.address, ethers.constants.MaxUint256);

        await spiceVault.connect(whale)["mint(uint256,uint256)"](0, amount);

        const beforeBalance = await weth.balanceOf(whale.address);

        const tx = await spiceVault
          .connect(whale)
          ["mint(uint256,uint256)"](1, amount);

        expect(await weth.balanceOf(whale.address)).to.be.eq(
          beforeBalance.sub(amount)
        );
        await expect(tx)
          .to.emit(spiceVault, "Deposit")
          .withArgs(whale.address, 1, amount, amount);
      });
    });

    describe("Withdraw", function () {
      beforeEach(async function () {
        const amount = ethers.utils.parseEther("100");
        await weth
          .connect(whale)
          .approve(spiceVault.address, ethers.constants.MaxUint256);

        await spiceVault.connect(whale)["deposit(uint256,uint256)"](0, amount.add(mintPrice));
      });

      it("When paused", async function () {
        await spiceVault.pause();

        const assets = ethers.utils.parseEther("10");
        await expect(
          spiceVault
            .connect(whale)
            ["withdraw(uint256,uint256,address)"](1, assets, alice.address)
        ).to.be.revertedWith("Pausable: paused");
      });

      it("When tokenId is 0", async function () {
        const assets = ethers.utils.parseEther("10");
        await expect(
          spiceVault
            .connect(whale)
            ["withdraw(uint256,uint256,address)"](0, assets, alice.address)
        ).to.be.revertedWithCustomError(spiceVault, "ParameterOutOfBounds");
      });

      it("When assets is 0", async function () {
        await expect(
          spiceVault
            .connect(whale)
            ["withdraw(uint256,uint256,address)"](1, 0, alice.address)
        ).to.be.revertedWithCustomError(spiceVault, "ParameterOutOfBounds");
      });

      it("When receiver is 0x0", async function () {
        const assets = ethers.utils.parseEther("10");
        await expect(
          spiceVault
            .connect(whale)
            ["withdraw(uint256,uint256,address)"](
              1,
              assets,
              ethers.constants.AddressZero
            )
        ).to.be.revertedWithCustomError(spiceVault, "InvalidAddress");
      });

      it("When metadata not revealed", async function () {
        const assets = ethers.utils.parseEther("10");
        await expect(
          spiceVault
            .connect(whale)
            ["withdraw(uint256,uint256,address)"](1, assets, alice.address)
        ).to.be.revertedWithCustomError(spiceVault, "WithdrawBeforeReveal");
      });

      it("When withdraw is not enabled", async function () {
        await spiceVault.setBaseURI("uri://");

        const assets = ethers.utils.parseEther("10");
        await expect(
          spiceVault
            .connect(whale)
            ["withdraw(uint256,uint256,address)"](1, assets, alice.address)
        ).to.be.revertedWithCustomError(spiceVault, "WithdrawDisabled");
      });

      it("When token does not exist", async function () {
        await spiceVault.setBaseURI("uri://");
        await spiceVault.setWithdrawable(true);

        const assets = ethers.utils.parseEther("10");
        await expect(
          spiceVault
            .connect(whale)
            ["withdraw(uint256,uint256,address)"](2, assets, alice.address)
        ).to.be.revertedWith("ERC721: invalid token ID");
      });

      it("When not owning token", async function () {
        await spiceVault.setBaseURI("uri://");
        await spiceVault.setWithdrawable(true);

        await spiceVault
          .connect(whale)
          ["safeTransferFrom(address,address,uint256)"](
            whale.address,
            alice.address,
            1
          );

        const assets = ethers.utils.parseEther("10");
        await expect(
          spiceVault
            .connect(whale)
            ["withdraw(uint256,uint256,address)"](1, assets, alice.address)
        ).to.be.revertedWithCustomError(spiceVault, "InvalidTokenId");
      });

      it("When share balance is not enough", async function () {
        await spiceVault.setBaseURI("uri://");
        await spiceVault.setWithdrawable(true);

        const assets = ethers.utils.parseEther("101");
        await expect(
          spiceVault
            .connect(whale)
            ["withdraw(uint256,uint256,address)"](1, assets, alice.address)
        ).to.be.revertedWithCustomError(spiceVault, "InsufficientShareBalance");
      });

      it("When vault balance is not enough", async function () {
        const interest = ethers.utils.parseEther("50"); // fees: 3.5 ETH
        await weth.connect(whale).transfer(spiceVault.address, interest);

        // keeps 2 ETH in the vault, 1.5 ETH will be withdrawn
        await depositToVaults(
          [vault.address, bend.address],
          [ethers.utils.parseEther("20"), ethers.utils.parseEther("128")]
        );

        expect(await vault.maxWithdraw(spiceVault.address)).to.be.gt(0);
        const beforeBendDeposit = await bend.maxWithdraw(spiceVault.address);
        expect(beforeBendDeposit).to.be.gt(0);

        await spiceVault.setBaseURI("uri://");
        await spiceVault.setWithdrawable(true);

        const assets = ethers.utils.parseEther("50");
        await spiceVault
          .connect(whale)
          ["withdraw(uint256,uint256,address)"](1, assets, alice.address);

        expect(await vault.maxWithdraw(spiceVault.address)).to.be.eq(0);
        expect(await bend.maxWithdraw(spiceVault.address)).to.be.closeTo(
          beforeBendDeposit.sub(ethers.utils.parseEther("31.5")), // 50 - (20 - 1.5) = 31.5
          ethers.utils.parseEther("0.00001")
        );
      });

      it("Split fees properly", async function () {
        const amount = ethers.utils.parseEther("90");
        const interest = ethers.utils.parseEther("10");
        await weth.connect(whale).transfer(spiceVault.address, interest);
        const beforeBalance1 = await weth.balanceOf(
          constants.accounts.Multisig
        );
        const beforeBalance2 = await weth.balanceOf(treasury.address);
        const beforeBalance3 = await weth.balanceOf(alice.address);
        const fees = interest.mul(700).div(10000);
        const fees1 = fees.div(2);
        const fees2 = fees.sub(fees1);

        await spiceVault.setBaseURI("uri://");
        await spiceVault.setWithdrawable(true);

        const shares = await spiceVault
          .connect(whale)
          .callStatic["withdraw(uint256,uint256,address)"](
            1,
            amount,
            alice.address
          );

        const tx = await spiceVault
          .connect(whale)
          ["withdraw(uint256,uint256,address)"](1, amount, alice.address);

        expect(await weth.balanceOf(constants.accounts.Multisig)).to.be.eq(
          beforeBalance1.add(fees1)
        );
        expect(await weth.balanceOf(treasury.address)).to.be.eq(
          beforeBalance2.add(fees2)
        );
        expect(await weth.balanceOf(alice.address)).to.be.eq(
          beforeBalance3.add(amount)
        );
        await expect(tx)
          .to.emit(spiceVault, "Withdraw")
          .withArgs(whale.address, 1, alice.address, amount, shares);
      });
    });

    describe("Redeem", function () {
      beforeEach(async function () {
        const amount = ethers.utils.parseEther("100");
        await weth
          .connect(whale)
          .approve(spiceVault.address, ethers.constants.MaxUint256);

        await spiceVault.connect(whale)["deposit(uint256,uint256)"](0, amount.add(mintPrice));
      });

      it("When paused", async function () {
        await spiceVault.pause();

        const shares = ethers.utils.parseEther("100");
        await expect(
          spiceVault
            .connect(whale)
            ["redeem(uint256,uint256,address)"](1, shares, alice.address)
        ).to.be.revertedWith("Pausable: paused");
      });

      it("When tokenId is 0", async function () {
        const shares = ethers.utils.parseEther("100");
        await expect(
          spiceVault
            .connect(whale)
            ["redeem(uint256,uint256,address)"](0, shares, alice.address)
        ).to.be.revertedWithCustomError(spiceVault, "ParameterOutOfBounds");
      });

      it("When assets is 0", async function () {
        await expect(
          spiceVault
            .connect(whale)
            ["redeem(uint256,uint256,address)"](1, 0, alice.address)
        ).to.be.revertedWithCustomError(spiceVault, "ParameterOutOfBounds");
      });

      it("When receiver is 0x0", async function () {
        const shares = ethers.utils.parseEther("100");
        await expect(
          spiceVault
            .connect(whale)
            ["redeem(uint256,uint256,address)"](
              1,
              shares,
              ethers.constants.AddressZero
            )
        ).to.be.revertedWithCustomError(spiceVault, "InvalidAddress");
      });

      it("When metadata not revealed", async function () {
        const shares = ethers.utils.parseEther("100");
        await expect(
          spiceVault
            .connect(whale)
            ["redeem(uint256,uint256,address)"](1, shares, alice.address)
        ).to.be.revertedWithCustomError(spiceVault, "WithdrawBeforeReveal");
      });

      it("When withdraw is not enabled", async function () {
        await spiceVault.setBaseURI("uri://");

        const shares = ethers.utils.parseEther("100");
        await expect(
          spiceVault
            .connect(whale)
            ["redeem(uint256,uint256,address)"](1, shares, alice.address)
        ).to.be.revertedWithCustomError(spiceVault, "WithdrawDisabled");
      });

      it("When token does not exist", async function () {
        await spiceVault.setBaseURI("uri://");
        await spiceVault.setWithdrawable(true);

        const shares = ethers.utils.parseEther("100");
        await expect(
          spiceVault
            .connect(whale)
            ["redeem(uint256,uint256,address)"](2, shares, alice.address)
        ).to.be.revertedWith("ERC721: invalid token ID");
      });

      it("When not owning token", async function () {
        await spiceVault.setBaseURI("uri://");
        await spiceVault.setWithdrawable(true);
        await spiceVault
          .connect(whale)
          ["safeTransferFrom(address,address,uint256)"](
            whale.address,
            alice.address,
            1
          );

        const shares = ethers.utils.parseEther("100");
        await expect(
          spiceVault
            .connect(whale)
            ["redeem(uint256,uint256,address)"](1, shares, alice.address)
        ).to.be.revertedWithCustomError(spiceVault, "InvalidTokenId");
      });

      it("When share balance is not enough", async function () {
        await spiceVault.setBaseURI("uri://");
        await spiceVault.setWithdrawable(true);

        const shares = ethers.utils.parseEther("110");
        await expect(
          spiceVault
            .connect(whale)
            ["redeem(uint256,uint256,address)"](1, shares, alice.address)
        ).to.be.revertedWithCustomError(spiceVault, "InsufficientShareBalance");
      });

      it("When vault balance is not enough", async function () {
        const interest = ethers.utils.parseEther("50"); // fees: 3.5 ETH
        await weth.connect(whale).transfer(spiceVault.address, interest);

        // keeps 2 ETH in the vault, 1.5 ETH will be withdrawn
        await depositToVaults(
          [vault.address, bend.address],
          [ethers.utils.parseEther("20"), ethers.utils.parseEther("128")]
        );

        expect(await vault.maxWithdraw(spiceVault.address)).to.be.gt(0);
        const beforeBendDeposit = await bend.maxWithdraw(spiceVault.address);
        expect(beforeBendDeposit).to.be.gt(0);

        await spiceVault.setBaseURI("uri://");
        await spiceVault.setWithdrawable(true);

        const shares = ethers.utils.parseEther("50"); // 73.25 ETH will be withdrawn
        await spiceVault
          .connect(whale)
          ["redeem(uint256,uint256,address)"](1, shares, alice.address);

        expect(await vault.maxWithdraw(spiceVault.address)).to.be.eq(0);
        expect(await bend.maxWithdraw(spiceVault.address)).to.be.closeTo(
          beforeBendDeposit.sub(ethers.utils.parseEther("54.75")), // 73.25 - (20 - 1.5) = 54.75
          ethers.utils.parseEther("0.00001")
        );
      });

      it("Split fees properly", async function () {
        const shares = ethers.utils.parseEther("100");
        const interest = ethers.utils.parseEther("20");
        await weth.connect(whale).transfer(spiceVault.address, interest);
        const beforeBalance1 = await weth.balanceOf(
          constants.accounts.Multisig
        );
        const beforeBalance2 = await weth.balanceOf(treasury.address);
        const beforeBalance3 = await weth.balanceOf(alice.address);

        await spiceVault.setBaseURI("uri://");
        await spiceVault.setWithdrawable(true);

        const assets = await spiceVault
          .connect(whale)
          .callStatic["redeem(uint256,uint256,address)"](
            1,
            shares,
            alice.address
          );

        const fees = interest.mul(700).div(10000);
        const fees1 = fees.div(2);
        const fees2 = fees.sub(fees1);

        const tx = await spiceVault
          .connect(whale)
          ["redeem(uint256,uint256,address)"](1, shares, alice.address);

        expect(await weth.balanceOf(constants.accounts.Multisig)).to.be.eq(
          beforeBalance1.add(fees1)
        );
        expect(await weth.balanceOf(treasury.address)).to.be.eq(
          beforeBalance2.add(fees2)
        );
        expect(await weth.balanceOf(alice.address)).to.be.eq(
          beforeBalance3.add(shares).add(interest).sub(fees)
        );
        await expect(tx)
          .to.emit(spiceVault, "Withdraw")
          .withArgs(whale.address, 1, alice.address, assets, shares);
      });
    });

    describe("DepositETH", function () {
      it("When paused", async function () {
        await spiceVault.pause();

        const amount = ethers.utils.parseEther("100");

        await expect(
          spiceVault.connect(alice).depositETH(0, { value: amount })
        ).to.be.revertedWith("Pausable: paused");
      });

      it("Should not deposit 0 amounts", async function () {
        await expect(
          spiceVault.connect(alice).depositETH(0, { value: mintPrice })
        ).to.be.revertedWithCustomError(spiceVault, "ParameterOutOfBounds");
      });

      it("Mint new NFT and deposit", async function () {
        const amount = ethers.utils.parseEther("100");
        const tx = await spiceVault
          .connect(alice)
          .depositETH(0, { value: amount.add(mintPrice) });

        expect(await spiceVault.ownerOf(1)).to.be.eq(alice.address);
        await expect(tx)
          .to.emit(spiceVault, "Deposit")
          .withArgs(alice.address, 1, amount, amount);
      });

      it("Can't mint twice on same wallet", async function () {
        const amount = ethers.utils.parseEther("100");
        await spiceVault
          .connect(alice)
          .depositETH(0, { value: amount.add(mintPrice) });

        await expect(
          spiceVault
            .connect(alice)
            .depositETH(0, { value: amount.add(mintPrice) })
        ).to.be.revertedWithCustomError(spiceVault, "MoreThanOne");
      });

      it("Can't mint more than maxSupply", async function () {
        const amount = ethers.utils.parseEther("10");

        await spiceVault.connect(alice).depositETH(0, { value: amount });
        await spiceVault.connect(bob).depositETH(0, { value: amount });
        await spiceVault.connect(carol).depositETH(0, { value: amount });
        await expect(
          spiceVault.connect(whale).depositETH(0, { value: amount })
        ).to.be.revertedWithCustomError(spiceVault, "OutOfSupply");
      });

      it("When not owning NFT", async function () {
        const amount = ethers.utils.parseEther("10");

        await spiceVault.connect(alice).depositETH(0, { value: amount });

        await spiceVault
          .connect(alice)
          ["safeTransferFrom(address,address,uint256)"](
            alice.address,
            whale.address,
            1
          );

        await expect(
          spiceVault.connect(alice).depositETH(1, { value: amount })
        ).to.be.revertedWithCustomError(spiceVault, "InvalidTokenId");
      });

      it("Deposit using NFT", async function () {
        const amount = ethers.utils.parseEther("10");

        await spiceVault
          .connect(alice)
          .depositETH(0, { value: amount.add(mintPrice) });

        const tx = await spiceVault
          .connect(alice)
          .depositETH(1, { value: amount });

        await expect(tx)
          .to.emit(spiceVault, "Deposit")
          .withArgs(alice.address, 1, amount, amount);
      });
    });

    describe("MintETH", function () {
      it("When paused", async function () {
        await spiceVault.pause();

        const amount = ethers.utils.parseEther("100");
        await expect(
          spiceVault
            .connect(whale)
            .mintETH(0, amount, { value: amount.add(mintPrice) })
        ).to.be.revertedWith("Pausable: paused");
      });

      it("Should not deposit 0 amounts", async function () {
        await expect(
          spiceVault.connect(whale).mintETH(0, 0, { value: mintPrice })
        ).to.be.revertedWithCustomError(spiceVault, "ParameterOutOfBounds");
      });

      it("Should not deposit less than mintPrice", async function () {
        await expect(
          spiceVault.connect(whale).mintETH(0, 1, { value: 0 })
        ).to.be.revertedWithCustomError(spiceVault, "ParameterOutOfBounds");
      });

      it("Mint new NFT and deposit", async function () {
        const amount = ethers.utils.parseEther("100");
        const tx = await spiceVault
          .connect(alice)
          .mintETH(0, amount, { value: amount.add(mintPrice) });

        expect(await spiceVault.ownerOf(1)).to.be.eq(alice.address);
        await expect(tx)
          .to.emit(spiceVault, "Deposit")
          .withArgs(alice.address, 1, amount, amount);
      });

      it("Deposit and refund", async function () {
        const amount = ethers.utils.parseEther("100");
        const tx = await spiceVault.connect(alice).mintETH(0, amount, {
          value: amount.add(mintPrice).add(ethers.utils.parseEther("10")),
        });

        expect(await spiceVault.ownerOf(1)).to.be.eq(alice.address);
        await expect(tx)
          .to.emit(spiceVault, "Deposit")
          .withArgs(alice.address, 1, amount, amount);
      });

      it("Can't mint twice on same wallet", async function () {
        const amount = ethers.utils.parseEther("100");
        await spiceVault
          .connect(alice)
          .mintETH(0, amount, { value: amount.add(mintPrice) });

        await expect(
          spiceVault
            .connect(alice)
            .mintETH(0, amount, { value: amount.add(mintPrice) })
        ).to.be.revertedWithCustomError(spiceVault, "MoreThanOne");
      });

      it("When not owning NFT", async function () {
        const amount = ethers.utils.parseEther("10");
        await spiceVault
          .connect(alice)
          .mintETH(0, amount, { value: amount.add(mintPrice) });

        await spiceVault
          .connect(alice)
          ["safeTransferFrom(address,address,uint256)"](
            alice.address,
            whale.address,
            1
          );

        await expect(
          spiceVault.connect(alice).mintETH(1, amount, { value: amount })
        ).to.be.revertedWithCustomError(spiceVault, "InvalidTokenId");
      });

      it("Deposit using NFT", async function () {
        const amount = ethers.utils.parseEther("10");
        await spiceVault
          .connect(alice)
          .mintETH(0, amount, { value: amount.add(mintPrice) });

        const tx = await spiceVault
          .connect(alice)
          .mintETH(1, amount, { value: amount });

        await expect(tx)
          .to.emit(spiceVault, "Deposit")
          .withArgs(alice.address, 1, amount, amount);
      });
    });

    describe("WithdrawETH", function () {
      beforeEach(async function () {
        const amount = ethers.utils.parseEther("100");
        await spiceVault
          .connect(alice)
          .depositETH(0, { value: amount.add(mintPrice) });
      });

      it("When paused", async function () {
        await spiceVault.pause();

        const assets = ethers.utils.parseEther("10");
        await expect(
          spiceVault.connect(alice).withdrawETH(1, assets, bob.address)
        ).to.be.revertedWith("Pausable: paused");
      });

      it("When tokenId is 0", async function () {
        const assets = ethers.utils.parseEther("10");
        await expect(
          spiceVault.connect(alice).withdrawETH(0, assets, bob.address)
        ).to.be.revertedWithCustomError(spiceVault, "ParameterOutOfBounds");
      });

      it("When assets is 0", async function () {
        await expect(
          spiceVault.connect(alice).withdrawETH(1, 0, bob.address)
        ).to.be.revertedWithCustomError(spiceVault, "ParameterOutOfBounds");
      });

      it("When receiver is 0x0", async function () {
        const assets = ethers.utils.parseEther("10");
        await expect(
          spiceVault
            .connect(alice)
            .withdrawETH(1, assets, ethers.constants.AddressZero)
        ).to.be.revertedWithCustomError(spiceVault, "InvalidAddress");
      });

      it("When metadata not revealed", async function () {
        const assets = ethers.utils.parseEther("10");
        await expect(
          spiceVault.connect(alice).withdrawETH(1, assets, bob.address)
        ).to.be.revertedWithCustomError(spiceVault, "WithdrawBeforeReveal");
      });

      it("When withdraw is not enabled", async function () {
        await spiceVault.setBaseURI("uri://");

        const assets = ethers.utils.parseEther("10");
        await expect(
          spiceVault.connect(alice).withdrawETH(1, assets, bob.address)
        ).to.be.revertedWithCustomError(spiceVault, "WithdrawDisabled");
      });

      it("When token does not exist", async function () {
        await spiceVault.setBaseURI("uri://");
        await spiceVault.setWithdrawable(true);

        const assets = ethers.utils.parseEther("10");
        await expect(
          spiceVault.connect(alice).withdrawETH(2, assets, bob.address)
        ).to.be.revertedWith("ERC721: invalid token ID");
      });

      it("When not owning token", async function () {
        await spiceVault.setBaseURI("uri://");
        await spiceVault.setWithdrawable(true);

        await spiceVault
          .connect(alice)
          ["safeTransferFrom(address,address,uint256)"](
            alice.address,
            whale.address,
            1
          );

        const assets = ethers.utils.parseEther("10");
        await expect(
          spiceVault.connect(alice).withdrawETH(1, assets, bob.address)
        ).to.be.revertedWithCustomError(spiceVault, "InvalidTokenId");
      });

      it("When share balance is not enough", async function () {
        await spiceVault.setBaseURI("uri://");
        await spiceVault.setWithdrawable(true);

        const assets = ethers.utils.parseEther("101");
        await expect(
          spiceVault.connect(alice).withdrawETH(1, assets, bob.address)
        ).to.be.revertedWithCustomError(spiceVault, "InsufficientShareBalance");
      });

      it("When vault balance is not enough", async function () {
        const interest = ethers.utils.parseEther("50"); // fees: 3.5 ETH
        await weth.connect(whale).transfer(spiceVault.address, interest);

        // keeps 2 ETH in the vault, 1.5 ETH will be withdrawn
        await depositToVaults(
          [vault.address, bend.address],
          [ethers.utils.parseEther("20"), ethers.utils.parseEther("128")]
        );

        expect(await vault.maxWithdraw(spiceVault.address)).to.be.gt(0);
        const beforeBendDeposit = await bend.maxWithdraw(spiceVault.address);
        expect(beforeBendDeposit).to.be.gt(0);

        await spiceVault.setBaseURI("uri://");
        await spiceVault.setWithdrawable(true);

        const assets = ethers.utils.parseEther("50");
        await spiceVault.connect(alice).withdrawETH(1, assets, bob.address);

        expect(await vault.maxWithdraw(spiceVault.address)).to.be.eq(0);
        expect(await bend.maxWithdraw(spiceVault.address)).to.be.closeTo(
          beforeBendDeposit.sub(ethers.utils.parseEther("31.5")), // 50 - (20 - 1.5) = 31.5
          ethers.utils.parseEther("0.00001")
        );
      });

      it("Split fees properly", async function () {
        const amount = ethers.utils.parseEther("100");
        const interest = ethers.utils.parseEther("20");
        await weth.connect(whale).transfer(spiceVault.address, interest);
        const beforeBalance1 = await weth.balanceOf(
          constants.accounts.Multisig
        );
        const beforeBalance2 = await weth.balanceOf(treasury.address);
        const beforeBalance3 = await ethers.provider.getBalance(bob.address);
        const fees = interest.mul(700).div(10000);
        const fees1 = fees.div(2);
        const fees2 = fees.sub(fees1);

        await spiceVault.setBaseURI("uri://");
        await spiceVault.setWithdrawable(true);

        const shares = await spiceVault
          .connect(alice)
          .callStatic.withdrawETH(1, amount, bob.address);

        const tx = await spiceVault
          .connect(alice)
          .withdrawETH(1, amount, bob.address);

        expect(await weth.balanceOf(constants.accounts.Multisig)).to.be.eq(
          beforeBalance1.add(fees1)
        );
        expect(await weth.balanceOf(treasury.address)).to.be.eq(
          beforeBalance2.add(fees2)
        );
        expect(await ethers.provider.getBalance(bob.address)).to.be.eq(
          beforeBalance3.add(amount)
        );
        await expect(tx)
          .to.emit(spiceVault, "Withdraw")
          .withArgs(alice.address, 1, bob.address, amount, shares);
      });
    });

    describe("RedeemETH", function () {
      beforeEach(async function () {
        const amount = ethers.utils.parseEther("100");
        await spiceVault
          .connect(alice)
          .depositETH(0, { value: amount.add(mintPrice) });
      });

      it("When paused", async function () {
        await spiceVault.pause();

        const shares = ethers.utils.parseEther("100");
        await expect(
          spiceVault.connect(alice).redeemETH(1, shares, bob.address)
        ).to.be.revertedWith("Pausable: paused");
      });

      it("When tokenId is 0", async function () {
        const shares = ethers.utils.parseEther("100");
        await expect(
          spiceVault.connect(alice).redeemETH(0, shares, bob.address)
        ).to.be.revertedWithCustomError(spiceVault, "ParameterOutOfBounds");
      });

      it("When assets is 0", async function () {
        await expect(
          spiceVault.connect(alice).redeemETH(1, 0, bob.address)
        ).to.be.revertedWithCustomError(spiceVault, "ParameterOutOfBounds");
      });

      it("When receiver is 0x0", async function () {
        const shares = ethers.utils.parseEther("100");
        await expect(
          spiceVault
            .connect(alice)
            .redeemETH(1, shares, ethers.constants.AddressZero)
        ).to.be.revertedWithCustomError(spiceVault, "InvalidAddress");
      });

      it("When metadata not revealed", async function () {
        const shares = ethers.utils.parseEther("100");
        await expect(
          spiceVault.connect(alice).redeemETH(1, shares, bob.address)
        ).to.be.revertedWithCustomError(spiceVault, "WithdrawBeforeReveal");
      });

      it("When withdraw is not enabled", async function () {
        await spiceVault.setBaseURI("uri://");

        const shares = ethers.utils.parseEther("100");
        await expect(
          spiceVault.connect(alice).redeemETH(1, shares, bob.address)
        ).to.be.revertedWithCustomError(spiceVault, "WithdrawDisabled");
      });

      it("When token does not exist", async function () {
        await spiceVault.setBaseURI("uri://");
        await spiceVault.setWithdrawable(true);

        const shares = ethers.utils.parseEther("100");
        await expect(
          spiceVault.connect(alice).redeemETH(2, shares, bob.address)
        ).to.be.revertedWith("ERC721: invalid token ID");
      });

      it("When not owning token", async function () {
        await spiceVault.setBaseURI("uri://");
        await spiceVault.setWithdrawable(true);
        await spiceVault
          .connect(alice)
          ["safeTransferFrom(address,address,uint256)"](
            alice.address,
            whale.address,
            1
          );

        const shares = ethers.utils.parseEther("100");
        await expect(
          spiceVault.connect(alice).redeemETH(1, shares, bob.address)
        ).to.be.revertedWithCustomError(spiceVault, "InvalidTokenId");
      });

      it("When share balance is not enough", async function () {
        await spiceVault.setBaseURI("uri://");
        await spiceVault.setWithdrawable(true);

        const shares = ethers.utils.parseEther("110");
        await expect(
          spiceVault.connect(alice).redeemETH(1, shares, bob.address)
        ).to.be.revertedWithCustomError(spiceVault, "InsufficientShareBalance");
      });

      it("When vault balance is not enough", async function () {
        const interest = ethers.utils.parseEther("50"); // fees: 3.5 ETH
        await weth.connect(whale).transfer(spiceVault.address, interest);

        // keeps 2 ETH in the vault, 1.5 ETH will be withdrawn
        await depositToVaults(
          [vault.address, bend.address],
          [ethers.utils.parseEther("20"), ethers.utils.parseEther("128")]
        );

        expect(await vault.maxWithdraw(spiceVault.address)).to.be.gt(0);
        const beforeBendDeposit = await bend.maxWithdraw(spiceVault.address);
        expect(beforeBendDeposit).to.be.gt(0);

        await spiceVault.setBaseURI("uri://");
        await spiceVault.setWithdrawable(true);

        const shares = ethers.utils.parseEther("50"); // 73.25 ETH will be withdrawn
        await spiceVault.connect(alice).redeemETH(1, shares, alice.address);

        expect(await vault.maxWithdraw(spiceVault.address)).to.be.eq(0);
        expect(await bend.maxWithdraw(spiceVault.address)).to.be.closeTo(
          beforeBendDeposit.sub(ethers.utils.parseEther("54.75")), // 73.25 - (20 - 1.5) = 54.75
          ethers.utils.parseEther("0.00001")
        );
      });

      it("Split fees properly", async function () {
        const shares = ethers.utils.parseEther("100");
        const interest = ethers.utils.parseEther("20");
        await weth.connect(whale).transfer(spiceVault.address, interest);
        const beforeBalance1 = await weth.balanceOf(
          constants.accounts.Multisig
        );
        const beforeBalance2 = await weth.balanceOf(treasury.address);
        const beforeBalance3 = await ethers.provider.getBalance(bob.address);

        await spiceVault.setBaseURI("uri://");
        await spiceVault.setWithdrawable(true);

        const assets = await spiceVault
          .connect(alice)
          .callStatic.redeemETH(1, shares, alice.address);

        const fees = interest.mul(700).div(10000);
        const fees1 = fees.div(2);
        const fees2 = fees.sub(fees1);

        const tx = await spiceVault
          .connect(alice)
          .redeemETH(1, shares, bob.address);

        expect(await weth.balanceOf(constants.accounts.Multisig)).to.be.eq(
          beforeBalance1.add(fees1)
        );
        expect(await weth.balanceOf(treasury.address)).to.be.eq(
          beforeBalance2.add(fees2)
        );
        expect(await ethers.provider.getBalance(bob.address)).to.be.eq(
          beforeBalance3.add(shares).add(interest).sub(fees)
        );
        await expect(tx)
          .to.emit(spiceVault, "Withdraw")
          .withArgs(alice.address, 1, bob.address, assets, shares);
      });
    });
  });

  describe("Strategist Actions", function () {
    describe("Vault", function () {
      describe("Deposit", function () {
        beforeEach(async function () {
          const assets = ethers.utils.parseEther("100");
          await weth
            .connect(whale)
            .approve(spiceVault.address, ethers.constants.MaxUint256);
          await spiceVault
            .connect(whale)
            ["deposit(uint256,uint256)"](0, assets.add(mintPrice));
        });

        it("Only strategist can call", async function () {
          const assets = ethers.utils.parseEther("100");
          const shares = await vault.previewDeposit(assets);
          await expect(
            spiceVault
              .connect(alice)
              ["deposit(address,uint256,uint256)"](
                vault.address,
                assets,
                shares.mul(99).div(100)
              )
          ).to.be.revertedWith(
            `AccessControl: account ${alice.address.toLowerCase()} is missing role ${strategistRole}`
          );
        });

        it("Only deposit to vault", async function () {
          const assets = ethers.utils.parseEther("100");
          const shares = await vault.previewDeposit(assets);
          await expect(
            spiceVault
              .connect(strategist)
              ["deposit(address,uint256,uint256)"](
                token.address,
                assets,
                shares.mul(99).div(100)
              )
          ).to.be.revertedWith(
            `AccessControl: account ${token.address.toLowerCase()} is missing role ${vaultRole}`
          );
        });

        it("When slippage is too high", async function () {
          const assets = ethers.utils.parseEther("100");
          const shares = await vault.previewDeposit(assets);
          await expect(
            spiceVault
              .connect(strategist)
              ["deposit(address,uint256,uint256)"](
                vault.address,
                assets,
                shares.mul(101).div(100)
              )
          ).to.be.revertedWithCustomError(spiceVault, "SlippageTooHigh");
        });

        it("Take assets and mint shares", async function () {
          const assets = ethers.utils.parseEther("100");
          const shares = await vault.previewDeposit(assets);
          await spiceVault
            .connect(strategist)
            ["deposit(address,uint256,uint256)"](
              vault.address,
              assets,
              shares.mul(99).div(100)
            );

          expect(await vault.balanceOf(spiceVault.address)).to.be.eq(assets);
        });
      });

      describe("Mint", function () {
        beforeEach(async function () {
          const assets = ethers.utils.parseEther("100");
          await weth
            .connect(whale)
            .approve(spiceVault.address, ethers.constants.MaxUint256);
          await spiceVault
            .connect(whale)
            ["deposit(uint256,uint256)"](0, assets.add(mintPrice));
        });

        it("Only strategist can call", async function () {
          const shares = ethers.utils.parseEther("100");
          const assets = await vault.previewMint(shares);
          await expect(
            spiceVault
              .connect(alice)
              ["mint(address,uint256,uint256)"](
                vault.address,
                shares,
                assets.mul(101).div(100)
              )
          ).to.be.revertedWith(
            `AccessControl: account ${alice.address.toLowerCase()} is missing role ${strategistRole}`
          );
        });

        it("Only mint to vault", async function () {
          const shares = ethers.utils.parseEther("100");
          const assets = await vault.previewMint(shares);
          await expect(
            spiceVault
              .connect(strategist)
              ["mint(address,uint256,uint256)"](
                token.address,
                shares,
                assets.mul(101).div(100)
              )
          ).to.be.revertedWith(
            `AccessControl: account ${token.address.toLowerCase()} is missing role ${vaultRole}`
          );
        });

        it("When slippage is too high", async function () {
          const shares = ethers.utils.parseEther("100");
          const assets = await vault.previewMint(shares);
          await expect(
            spiceVault
              .connect(strategist)
              ["mint(address,uint256,uint256)"](
                vault.address,
                shares,
                assets.mul(99).div(100)
              )
          ).to.be.revertedWithCustomError(spiceVault, "SlippageTooHigh");
        });

        it("Take assets and mint shares", async function () {
          const shares = ethers.utils.parseEther("100");
          const assets = await vault.previewMint(shares);
          await spiceVault
            .connect(strategist)
            ["mint(address,uint256,uint256)"](
              vault.address,
              shares,
              assets.mul(101).div(100)
            );

          expect(await vault.balanceOf(spiceVault.address)).to.be.eq(shares);
        });
      });

      describe("Withdraw", function () {
        beforeEach(async function () {
          const assets = ethers.utils.parseEther("100");
          await weth
            .connect(whale)
            .approve(spiceVault.address, ethers.constants.MaxUint256);
          await spiceVault
            .connect(whale)
            ["deposit(uint256,uint256)"](0, assets.add(mintPrice));

          await spiceVault
            .connect(strategist)
            ["deposit(address,uint256,uint256)"](vault.address, assets, 0);
        });

        it("Only strategist can call", async function () {
          const assets = ethers.utils.parseEther("100");
          const shares = await vault.previewWithdraw(assets);
          await expect(
            spiceVault
              .connect(alice)
              ["withdraw(address,uint256,uint256)"](
                vault.address,
                assets,
                shares.mul(101).div(100)
              )
          ).to.be.revertedWith(
            `AccessControl: account ${alice.address.toLowerCase()} is missing role ${strategistRole}`
          );
        });

        it("Only withdraw from vault", async function () {
          const assets = ethers.utils.parseEther("100");
          const shares = await vault.previewWithdraw(assets);
          await expect(
            spiceVault
              .connect(strategist)
              ["withdraw(address,uint256,uint256)"](
                token.address,
                assets,
                shares.mul(101).div(100)
              )
          ).to.be.revertedWith(
            `AccessControl: account ${token.address.toLowerCase()} is missing role ${vaultRole}`
          );
        });

        it("When slippage is too high", async function () {
          const assets = ethers.utils.parseEther("50");
          const shares = await vault.previewWithdraw(assets);
          await expect(
            spiceVault
              .connect(strategist)
              ["withdraw(address,uint256,uint256)"](
                vault.address,
                assets,
                shares.mul(99).div(100)
              )
          ).to.be.revertedWithCustomError(spiceVault, "SlippageTooHigh");
        });

        it("Withdraw assets", async function () {
          const assets = ethers.utils.parseEther("50");
          const shares = await vault.previewWithdraw(assets);
          await spiceVault
            .connect(strategist)
            ["withdraw(address,uint256,uint256)"](
              vault.address,
              assets,
              shares.mul(101).div(100)
            );
        });
      });

      describe("Redeem", function () {
        beforeEach(async function () {
          const assets = ethers.utils.parseEther("100");
          await weth
            .connect(whale)
            .approve(spiceVault.address, ethers.constants.MaxUint256);
          await spiceVault
            .connect(whale)
            ["deposit(uint256,uint256)"](0, assets.add(mintPrice));

          await spiceVault
            .connect(strategist)
            ["deposit(address,uint256,uint256)"](vault.address, assets, 0);
        });

        it("Only strategist can call", async function () {
          const shares = ethers.utils.parseEther("100");
          const assets = await vault.previewRedeem(shares);
          await expect(
            spiceVault
              .connect(alice)
              ["redeem(address,uint256,uint256)"](
                vault.address,
                shares,
                assets.mul(99).div(100)
              )
          ).to.be.revertedWith(
            `AccessControl: account ${alice.address.toLowerCase()} is missing role ${strategistRole}`
          );
        });

        it("Only redeem from vault", async function () {
          const shares = ethers.utils.parseEther("100");
          const assets = await vault.previewRedeem(shares);
          await expect(
            spiceVault
              .connect(strategist)
              ["redeem(address,uint256,uint256)"](
                token.address,
                shares,
                assets.mul(99).div(100)
              )
          ).to.be.revertedWith(
            `AccessControl: account ${token.address.toLowerCase()} is missing role ${vaultRole}`
          );
        });

        it("When slippage is too high", async function () {
          const shares = ethers.utils.parseEther("100");
          const assets = await vault.previewRedeem(shares);
          await expect(
            spiceVault
              .connect(strategist)
              ["redeem(address,uint256,uint256)"](
                vault.address,
                shares,
                assets.mul(101).div(100)
              )
          ).to.be.revertedWithCustomError(spiceVault, "SlippageTooHigh");
        });

        it("Redeem assets", async function () {
          const shares = ethers.utils.parseEther("50");
          const assets = await vault.previewRedeem(shares);
          await spiceVault
            .connect(strategist)
            ["redeem(address,uint256,uint256)"](
              vault.address,
              shares,
              assets.mul(99).div(100)
            );
        });
      });
    });

    describe("Bend", function () {
      describe("Deposit", function () {
        beforeEach(async function () {
          const assets = ethers.utils.parseEther("100");
          await weth
            .connect(whale)
            .approve(spiceVault.address, ethers.constants.MaxUint256);
          await spiceVault
            .connect(whale)
            ["deposit(uint256,uint256)"](0, assets.add(mintPrice));
        });

        it("Only strategist can call", async function () {
          const assets = ethers.utils.parseEther("100");
          const shares = await bend.previewDeposit(assets);
          await expect(
            spiceVault
              .connect(alice)
              ["deposit(address,uint256,uint256)"](
                bend.address,
                assets,
                shares.mul(99).div(100)
              )
          ).to.be.revertedWith(
            `AccessControl: account ${alice.address.toLowerCase()} is missing role ${strategistRole}`
          );
        });

        it("Only deposit to bend", async function () {
          const assets = ethers.utils.parseEther("100");
          const shares = await bend.previewDeposit(assets);
          await expect(
            spiceVault
              .connect(strategist)
              ["deposit(address,uint256,uint256)"](
                token.address,
                assets,
                shares.mul(99).div(100)
              )
          ).to.be.revertedWith(
            `AccessControl: account ${token.address.toLowerCase()} is missing role ${vaultRole}`
          );
        });

        it("When slippage is too high", async function () {
          const assets = ethers.utils.parseEther("100");
          const shares = await bend.previewDeposit(assets);
          await expect(
            spiceVault
              .connect(strategist)
              ["deposit(address,uint256,uint256)"](
                bend.address,
                assets,
                shares.mul(101).div(100)
              )
          ).to.be.revertedWithCustomError(spiceVault, "SlippageTooHigh");
        });

        it("Take assets and mint shares", async function () {
          const assets = ethers.utils.parseEther("100");
          const shares = await bend.previewDeposit(assets);
          await spiceVault
            .connect(strategist)
            ["deposit(address,uint256,uint256)"](
              bend.address,
              assets,
              shares.mul(99).div(100)
            );

          expect(await bend.balanceOf(spiceVault.address)).to.be.eq(assets);
        });
      });

      describe("Mint", function () {
        beforeEach(async function () {
          const assets = ethers.utils.parseEther("100");
          await weth
            .connect(whale)
            .approve(spiceVault.address, ethers.constants.MaxUint256);
          await spiceVault
            .connect(whale)
            ["deposit(uint256,uint256)"](0, assets.add(mintPrice));
        });

        it("Only strategist can call", async function () {
          const shares = ethers.utils.parseEther("100");
          const assets = await bend.previewMint(shares);
          await expect(
            spiceVault
              .connect(alice)
              ["mint(address,uint256,uint256)"](
                bend.address,
                shares,
                assets.mul(101).div(100)
              )
          ).to.be.revertedWith(
            `AccessControl: account ${alice.address.toLowerCase()} is missing role ${strategistRole}`
          );
        });

        it("Only mint to bend", async function () {
          const shares = ethers.utils.parseEther("100");
          const assets = await bend.previewMint(shares);
          await expect(
            spiceVault
              .connect(strategist)
              ["mint(address,uint256,uint256)"](
                token.address,
                shares,
                assets.mul(101).div(100)
              )
          ).to.be.revertedWith(
            `AccessControl: account ${token.address.toLowerCase()} is missing role ${vaultRole}`
          );
        });

        it("When slippage is too high", async function () {
          const shares = ethers.utils.parseEther("100");
          const assets = await bend.previewMint(shares);
          await expect(
            spiceVault
              .connect(strategist)
              ["mint(address,uint256,uint256)"](
                bend.address,
                shares,
                assets.mul(99).div(100)
              )
          ).to.be.revertedWithCustomError(spiceVault, "SlippageTooHigh");
        });

        it("Take assets and mint shares", async function () {
          const shares = ethers.utils.parseEther("100");
          const assets = await bend.previewMint(shares);
          await spiceVault
            .connect(strategist)
            ["mint(address,uint256,uint256)"](
              bend.address,
              shares,
              assets.mul(101).div(100)
            );

          expect(await bend.balanceOf(spiceVault.address)).to.be.eq(shares);
        });
      });

      describe("Withdraw", function () {
        beforeEach(async function () {
          const assets = ethers.utils.parseEther("100");
          await weth
            .connect(whale)
            .approve(spiceVault.address, ethers.constants.MaxUint256);
          await spiceVault
            .connect(whale)
            ["deposit(uint256,uint256)"](0, assets.add(mintPrice));

          await spiceVault
            .connect(strategist)
            ["deposit(address,uint256,uint256)"](bend.address, assets, 0);
        });

        it("Only strategist can call", async function () {
          const assets = ethers.utils.parseEther("100");
          const shares = await bend.previewWithdraw(assets);
          await expect(
            spiceVault
              .connect(alice)
              ["withdraw(address,uint256,uint256)"](
                bend.address,
                assets,
                shares.mul(101).div(100)
              )
          ).to.be.revertedWith(
            `AccessControl: account ${alice.address.toLowerCase()} is missing role ${strategistRole}`
          );
        });

        it("Only withdraw from bend", async function () {
          const assets = ethers.utils.parseEther("100");
          const shares = await bend.previewWithdraw(assets);
          await expect(
            spiceVault
              .connect(strategist)
              ["withdraw(address,uint256,uint256)"](
                token.address,
                assets,
                shares.mul(101).div(100)
              )
          ).to.be.revertedWith(
            `AccessControl: account ${token.address.toLowerCase()} is missing role ${vaultRole}`
          );
        });

        it("When slippage is too high", async function () {
          const assets = ethers.utils.parseEther("100");
          const shares = await bend.previewWithdraw(assets);
          await expect(
            spiceVault
              .connect(strategist)
              ["withdraw(address,uint256,uint256)"](
                bend.address,
                assets,
                shares.mul(99).div(100)
              )
          ).to.be.revertedWithCustomError(spiceVault, "SlippageTooHigh");
        });

        it("Withdraw assets", async function () {
          const assets = ethers.utils.parseEther("50");
          const shares = await bend.previewWithdraw(assets);
          await spiceVault
            .connect(strategist)
            ["withdraw(address,uint256,uint256)"](
              bend.address,
              assets,
              shares.mul(101).div(100)
            );
        });
      });

      describe("Redeem", function () {
        beforeEach(async function () {
          const assets = ethers.utils.parseEther("100");
          await weth
            .connect(whale)
            .approve(spiceVault.address, ethers.constants.MaxUint256);
          await spiceVault
            .connect(whale)
            ["deposit(uint256,uint256)"](0, assets.add(mintPrice));

          await spiceVault
            .connect(strategist)
            ["deposit(address,uint256,uint256)"](bend.address, assets, 0);
        });

        it("Only strategist can call", async function () {
          const shares = ethers.utils.parseEther("100");
          const assets = await bend.previewRedeem(shares);
          await expect(
            spiceVault
              .connect(alice)
              ["redeem(address,uint256,uint256)"](
                bend.address,
                shares,
                assets.mul(99).div(100)
              )
          ).to.be.revertedWith(
            `AccessControl: account ${alice.address.toLowerCase()} is missing role ${strategistRole}`
          );
        });

        it("Only redeem from bend", async function () {
          const shares = ethers.utils.parseEther("100");
          const assets = await bend.previewRedeem(shares);
          await expect(
            spiceVault
              .connect(strategist)
              ["redeem(address,uint256,uint256)"](
                token.address,
                shares,
                assets.mul(99).div(100)
              )
          ).to.be.revertedWith(
            `AccessControl: account ${token.address.toLowerCase()} is missing role ${vaultRole}`
          );
        });

        it("When slippage is too high", async function () {
          const shares = ethers.utils.parseEther("100");
          const assets = await bend.previewRedeem(shares);
          await expect(
            spiceVault
              .connect(strategist)
              ["redeem(address,uint256,uint256)"](
                bend.address,
                shares,
                assets.mul(101).div(100)
              )
          ).to.be.revertedWithCustomError(spiceVault, "SlippageTooHigh");
        });

        it("Redeem assets", async function () {
          const shares = ethers.utils.parseEther("50");
          const assets = await bend.previewRedeem(shares);
          await spiceVault
            .connect(strategist)
            ["redeem(address,uint256,uint256)"](
              bend.address,
              shares,
              assets.mul(99).div(100)
            );
        });
      });
    });

    describe("Drops", function () {
      describe("Deposit", function () {
        beforeEach(async function () {
          const assets = ethers.utils.parseEther("100");
          await weth
            .connect(whale)
            .approve(spiceVault.address, ethers.constants.MaxUint256);
          await spiceVault
            .connect(whale)
            ["deposit(uint256,uint256)"](0, assets.add(mintPrice));
        });

        it("Only strategist can call", async function () {
          const assets = ethers.utils.parseEther("100");
          const shares = await drops.previewDeposit(assets);
          await expect(
            spiceVault
              .connect(alice)
              ["deposit(address,uint256,uint256)"](
                drops.address,
                assets,
                shares.mul(99).div(100)
              )
          ).to.be.revertedWith(
            `AccessControl: account ${alice.address.toLowerCase()} is missing role ${strategistRole}`
          );
        });

        it("Only deposit to drops", async function () {
          const assets = ethers.utils.parseEther("100");
          const shares = await drops.previewDeposit(assets);
          await expect(
            spiceVault
              .connect(strategist)
              ["deposit(address,uint256,uint256)"](
                token.address,
                assets,
                shares.mul(99).div(100)
              )
          ).to.be.revertedWith(
            `AccessControl: account ${token.address.toLowerCase()} is missing role ${vaultRole}`
          );
        });

        it("When slippage is too high", async function () {
          const assets = ethers.utils.parseEther("100");
          const shares = await drops.previewDeposit(assets);
          await expect(
            spiceVault
              .connect(strategist)
              ["deposit(address,uint256,uint256)"](
                drops.address,
                assets,
                shares.mul(101).div(100)
              )
          ).to.be.revertedWithCustomError(spiceVault, "SlippageTooHigh");
        });

        it("Take assets and mint shares", async function () {
          const assets = ethers.utils.parseEther("100");
          const shares = await drops.previewDeposit(assets);
          await spiceVault
            .connect(strategist)
            ["deposit(address,uint256,uint256)"](
              drops.address,
              assets,
              shares.mul(99).div(100)
            );

          expect(await drops.balanceOf(spiceVault.address)).to.be.closeTo(
            shares,
            shares.div(1000)
          );
        });
      });

      describe("Mint", function () {
        beforeEach(async function () {
          const assets = ethers.utils.parseEther("100");
          await weth
            .connect(whale)
            .approve(spiceVault.address, ethers.constants.MaxUint256);
          await spiceVault
            .connect(whale)
            ["deposit(uint256,uint256)"](0, assets.add(mintPrice));
        });

        it("Only strategist can call", async function () {
          const shares = ethers.utils.parseUnits("1000", 6);
          const assets = await drops.previewMint(shares);
          await expect(
            spiceVault
              .connect(alice)
              ["mint(address,uint256,uint256)"](
                drops.address,
                shares,
                assets.mul(101).div(100)
              )
          ).to.be.revertedWith(
            `AccessControl: account ${alice.address.toLowerCase()} is missing role ${strategistRole}`
          );
        });

        it("Only mint to drops", async function () {
          const shares = ethers.utils.parseUnits("1000", 6);
          const assets = await drops.previewMint(shares);
          await expect(
            spiceVault
              .connect(strategist)
              ["mint(address,uint256,uint256)"](
                token.address,
                shares,
                assets.mul(101).div(100)
              )
          ).to.be.revertedWith(
            `AccessControl: account ${token.address.toLowerCase()} is missing role ${vaultRole}`
          );
        });

        it("When slippage is too high", async function () {
          const shares = ethers.utils.parseUnits("1000", 6);
          const assets = await drops.previewMint(shares);
          await expect(
            spiceVault
              .connect(strategist)
              ["mint(address,uint256,uint256)"](
                drops.address,
                shares,
                assets.mul(99).div(100)
              )
          ).to.be.revertedWithCustomError(spiceVault, "SlippageTooHigh");
        });

        it("Take assets and mint shares", async function () {
          const shares = ethers.utils.parseUnits("1000", 6);
          const assets = await drops.previewMint(shares);
          await spiceVault
            .connect(strategist)
            ["mint(address,uint256,uint256)"](
              drops.address,
              shares,
              assets.mul(101).div(100)
            );

          expect(await drops.balanceOf(spiceVault.address)).to.be.closeTo(
            shares,
            shares.div(1000)
          );
        });
      });

      describe("Withdraw", function () {
        beforeEach(async function () {
          const assets = ethers.utils.parseEther("100");
          await weth
            .connect(whale)
            .approve(spiceVault.address, ethers.constants.MaxUint256);
          await spiceVault
            .connect(whale)
            ["deposit(uint256,uint256)"](0, assets.add(mintPrice));

          await spiceVault
            .connect(strategist)
            ["deposit(address,uint256,uint256)"](drops.address, assets, 0);
        });

        it("Only strategist can call", async function () {
          const assets = ethers.utils.parseEther("100");
          const shares = await drops.previewWithdraw(assets);
          await expect(
            spiceVault
              .connect(alice)
              ["withdraw(address,uint256,uint256)"](
                drops.address,
                assets,
                shares.mul(101).div(100)
              )
          ).to.be.revertedWith(
            `AccessControl: account ${alice.address.toLowerCase()} is missing role ${strategistRole}`
          );
        });

        it("Only withdraw from drops", async function () {
          const assets = ethers.utils.parseEther("100");
          const shares = await drops.previewWithdraw(assets);
          await expect(
            spiceVault
              .connect(strategist)
              ["withdraw(address,uint256,uint256)"](
                token.address,
                assets,
                shares.mul(101).div(100)
              )
          ).to.be.revertedWith(
            `AccessControl: account ${token.address.toLowerCase()} is missing role ${vaultRole}`
          );
        });

        it("When slippage is too high", async function () {
          const assets = ethers.utils.parseEther("50");
          const shares = await drops.previewWithdraw(assets);
          await expect(
            spiceVault
              .connect(strategist)
              ["withdraw(address,uint256,uint256)"](
                drops.address,
                assets,
                shares.mul(99).div(100)
              )
          ).to.be.revertedWithCustomError(spiceVault, "SlippageTooHigh");
        });

        it("Withdraw assets", async function () {
          const assets = ethers.utils.parseEther("50");
          const shares = await drops.previewWithdraw(assets);
          await spiceVault
            .connect(strategist)
            ["withdraw(address,uint256,uint256)"](
              drops.address,
              assets,
              shares.mul(101).div(100)
            );
        });
      });

      describe("Redeem", function () {
        beforeEach(async function () {
          const assets = ethers.utils.parseEther("100");
          await weth
            .connect(whale)
            .approve(spiceVault.address, ethers.constants.MaxUint256);
          await spiceVault
            .connect(whale)
            ["deposit(uint256,uint256)"](0, assets.add(mintPrice));

          await spiceVault
            .connect(strategist)
            ["deposit(address,uint256,uint256)"](drops.address, assets, 0);
        });

        it("Only strategist can call", async function () {
          const shares = ethers.utils.parseEther("50");
          const assets = await drops.previewRedeem(shares);
          await expect(
            spiceVault
              .connect(alice)
              ["redeem(address,uint256,uint256)"](
                drops.address,
                shares,
                assets.mul(99).div(100)
              )
          ).to.be.revertedWith(
            `AccessControl: account ${alice.address.toLowerCase()} is missing role ${strategistRole}`
          );
        });

        it("Only redeem from drops", async function () {
          const shares = ethers.utils.parseEther("50");
          const assets = await drops.previewRedeem(shares);
          await expect(
            spiceVault
              .connect(strategist)
              ["redeem(address,uint256,uint256)"](
                token.address,
                shares,
                assets.mul(99).div(100)
              )
          ).to.be.revertedWith(
            `AccessControl: account ${token.address.toLowerCase()} is missing role ${vaultRole}`
          );
        });

        it("When slippage is too high", async function () {
          const shares = ethers.utils.parseEther("50");
          const assets = await drops.previewRedeem(shares);
          await expect(
            spiceVault
              .connect(strategist)
              ["redeem(address,uint256,uint256)"](
                drops.address,
                shares,
                assets.mul(101).div(100)
              )
          ).to.be.revertedWithCustomError(spiceVault, "SlippageTooHigh");
        });

        it("Redeem assets", async function () {
          const shares = ethers.utils.parseEther("50");
          const assets = await drops.previewRedeem(shares);
          await spiceVault
            .connect(strategist)
            ["redeem(address,uint256,uint256)"](
              drops.address,
              shares,
              assets.mul(99).div(100)
            );
        });
      });
    });
  });

  describe("Admin Actions", function () {
    it("Set withdrawal fees", async function () {
      await expect(
        spiceVault.connect(alice).setWithdrawalFees(1000)
      ).to.be.revertedWith(
        `AccessControl: account ${alice.address.toLowerCase()} is missing role ${defaultAdminRole}`
      );

      await expect(
        spiceVault.connect(admin).setWithdrawalFees(10001)
      ).to.be.revertedWithCustomError(spiceVault, "ParameterOutOfBounds");

      await spiceVault.connect(admin).setWithdrawalFees(1000);

      expect(await spiceVault.withdrawalFees()).to.be.eq(1000);
    });

    it("Set Dev", async function () {
      await expect(
        spiceVault.connect(alice).setDev(carol.address)
      ).to.be.revertedWith(
        `AccessControl: account ${alice.address.toLowerCase()} is missing role ${defaultAdminRole}`
      );

      await expect(
        spiceVault.connect(admin).setDev(ethers.constants.AddressZero)
      ).to.be.revertedWithCustomError(spiceVault, "InvalidAddress");

      const tx = await spiceVault.connect(admin).setDev(carol.address);

      await expect(tx)
        .to.emit(spiceVault, "DevUpdated")
        .withArgs(carol.address);
      expect(await spiceVault.dev()).to.be.eq(carol.address);

      await checkRole(
        spiceVault,
        constants.accounts.Dev,
        defaultAdminRole,
        false
      );
      await checkRole(
        spiceVault,
        constants.accounts.Dev,
        strategistRole,
        false
      );
      await checkRole(spiceVault, carol.address, defaultAdminRole, true);
      await checkRole(spiceVault, carol.address, strategistRole, true);
    });

    it("Set Multisig", async function () {
      await expect(
        spiceVault.connect(alice).setMultisig(carol.address)
      ).to.be.revertedWith(
        `AccessControl: account ${alice.address.toLowerCase()} is missing role ${defaultAdminRole}`
      );

      await expect(
        spiceVault.connect(admin).setMultisig(ethers.constants.AddressZero)
      ).to.be.revertedWithCustomError(spiceVault, "InvalidAddress");

      const tx = await spiceVault.connect(admin).setMultisig(carol.address);

      await expect(tx)
        .to.emit(spiceVault, "MultisigUpdated")
        .withArgs(carol.address);
      expect(await spiceVault.multisig()).to.be.eq(carol.address);

      await checkRole(
        spiceVault,
        constants.accounts.Multisig,
        defaultAdminRole,
        false
      );
      await checkRole(
        spiceVault,
        constants.accounts.Multisig,
        assetReceiverRole,
        false
      );
      await checkRole(
        spiceVault,
        constants.accounts.Multisig,
        spiceRole,
        false
      );
      await checkRole(spiceVault, carol.address, defaultAdminRole, true);
      await checkRole(spiceVault, carol.address, assetReceiverRole, true);
      await checkRole(spiceVault, carol.address, spiceRole, true);
    });

    it("Set Fee Recipient", async function () {
      await expect(
        spiceVault.connect(alice).setFeeRecipient(carol.address)
      ).to.be.revertedWith(
        `AccessControl: account ${alice.address.toLowerCase()} is missing role ${defaultAdminRole}`
      );

      await expect(
        spiceVault.connect(admin).setFeeRecipient(ethers.constants.AddressZero)
      ).to.be.revertedWithCustomError(spiceVault, "InvalidAddress");

      const tx = await spiceVault.connect(admin).setFeeRecipient(carol.address);

      await expect(tx)
        .to.emit(spiceVault, "FeeRecipientUpdated")
        .withArgs(carol.address);
      expect(await spiceVault.feeRecipient()).to.be.eq(carol.address);
    });

    it("Set preview uri", async function () {
      await expect(
        spiceVault.connect(alice).setPreviewURI("previewuri://")
      ).to.be.revertedWith(
        `AccessControl: account ${alice.address.toLowerCase()} is missing role ${defaultAdminRole}`
      );

      await spiceVault.connect(admin).setPreviewURI("previewuri://");

      await spiceVault.connect(admin).setBaseURI("uri://");

      await expect(
        spiceVault.connect(admin).setPreviewURI("previewuri://")
      ).to.be.revertedWithCustomError(spiceVault, "MetadataRevealed");
    });

    it("Set base uri", async function () {
      await expect(
        spiceVault.connect(alice).setBaseURI("uri://")
      ).to.be.revertedWith(
        `AccessControl: account ${alice.address.toLowerCase()} is missing role ${defaultAdminRole}`
      );

      await spiceVault.connect(admin).setBaseURI("uri://");
    });

    it("Set verified", async function () {
      expect(await spiceVault.verified()).to.be.eq(false);

      await expect(
        spiceVault.connect(alice).setVerified(true)
      ).to.be.revertedWith(
        `AccessControl: account ${alice.address.toLowerCase()} is missing role ${spiceRole}`
      );

      await spiceVault.connect(spiceAdmin).setVerified(true);

      expect(await spiceVault.verified()).to.be.eq(true);
    });

    it("Set withdrawable", async function () {
      await expect(
        spiceVault.connect(alice).setWithdrawable(true)
      ).to.be.revertedWith(
        `AccessControl: account ${alice.address.toLowerCase()} is missing role ${defaultAdminRole}`
      );

      await spiceVault.connect(admin).setWithdrawable(true);
    });

    it("Pause", async function () {
      await expect(spiceVault.connect(alice).pause()).to.be.revertedWith(
        `AccessControl: account ${alice.address.toLowerCase()} is missing role ${defaultAdminRole}`
      );

      expect(await spiceVault.paused()).to.be.eq(false);

      const tx = await spiceVault.connect(admin).pause();

      await expect(tx).to.emit(spiceVault, "Paused").withArgs(admin.address);

      expect(await spiceVault.paused()).to.be.eq(true);
    });

    it("Unpause", async function () {
      await spiceVault.connect(admin).pause();

      await expect(spiceVault.connect(alice).unpause()).to.be.revertedWith(
        `AccessControl: account ${alice.address.toLowerCase()} is missing role ${defaultAdminRole}`
      );

      expect(await spiceVault.paused()).to.be.eq(true);

      const tx = await spiceVault.connect(admin).unpause();

      await expect(tx).to.emit(spiceVault, "Unpaused").withArgs(admin.address);

      expect(await spiceVault.paused()).to.be.eq(false);
    });
  });
});
