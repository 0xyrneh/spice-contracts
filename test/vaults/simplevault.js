const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { takeSnapshot, revertToSnapshot } = require("../helpers/snapshot");
const { impersonateAccount, setBalance } = require("../helpers/account");
const { signTestHashAndSignature } = require("../helpers/sign");
const constants = require("../constants");

describe("SimpleVault", function () {
  let vault;
  let token;
  let admin, alice, bob, carol, dave, treasury, marketplace1, marketplace2;
  let snapshotId;
  let dev;

  let defaultAdminRole,
    creatorRole,
    assetReceiverRole,
    liquidatorRole,
    bidderRole,
    whitelistRole,
    marketplaceRole;

  const vaultName = "Spice SimpleVault Test Token";
  const vaultSymbol = "svTT";
  const INVALID_SIGNATURE1 = "0x0000";
  const INVALID_SIGNATURE2 =
    "0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";

  async function deployTokenAndAirdrop(users, amount) {
    const Token = await ethers.getContractFactory("TestERC20");
    const token = await Token.deploy("TestToken", "TT");

    for (let i = 0; i < users.length; i++) {
      await token.mint(users[i].address, amount);
    }

    return token;
  }

  async function checkRole(user, role, check) {
    expect(await vault.hasRole(role, user)).to.equal(check);
  }

  before("Deploy", async function () {
    [admin, alice, bob, carol, dave, treasury, marketplace1, marketplace2] =
      await ethers.getSigners();

    await impersonateAccount(constants.accounts.Dev);
    await setBalance(
      constants.accounts.Dev,
      ethers.utils.parseEther("1000").toHexString()
    );
    dev = await ethers.getSigner(constants.accounts.Dev);

    await admin.sendTransaction({
      to: constants.accounts.Dev,
      value: ethers.utils.parseEther("10"),
    });

    const amount = ethers.utils.parseEther("1000000");
    token = await deployTokenAndAirdrop(
      [admin, alice, bob, carol, dave],
      amount
    );

    const SimpleVault = await ethers.getContractFactory("SimpleVault");
    const beacon = await upgrades.deployBeacon(SimpleVault);

    await expect(
      upgrades.deployBeaconProxy(beacon, SimpleVault, [
        vaultName,
        vaultSymbol,
        ethers.constants.AddressZero,
        [marketplace1.address, marketplace2.address],
        admin.address,
        constants.accounts.Dev,
        constants.accounts.Multisig,
        treasury.address,
      ])
    ).to.be.revertedWithCustomError(SimpleVault, "InvalidAddress");
    await expect(
      upgrades.deployBeaconProxy(beacon, SimpleVault, [
        vaultName,
        vaultSymbol,
        token.address,
        [marketplace1.address, ethers.constants.AddressZero],
        admin.address,
        constants.accounts.Dev,
        constants.accounts.Multisig,
        treasury.address,
      ])
    ).to.be.revertedWithCustomError(SimpleVault, "InvalidAddress");
    await expect(
      upgrades.deployBeaconProxy(beacon, SimpleVault, [
        vaultName,
        vaultSymbol,
        token.address,
        [marketplace1.address, marketplace2.address],
        ethers.constants.AddressZero,
        constants.accounts.Dev,
        constants.accounts.Multisig,
        treasury.address,
      ])
    ).to.be.revertedWithCustomError(SimpleVault, "InvalidAddress");

    await expect(
      upgrades.deployBeaconProxy(beacon, SimpleVault, [
        vaultName,
        vaultSymbol,
        token.address,
        [marketplace1.address, marketplace2.address],
        admin.address,
        ethers.constants.AddressZero,
        constants.accounts.Multisig,
        treasury.address,
      ])
    ).to.be.revertedWithCustomError(SimpleVault, "InvalidAddress");

    await expect(
      upgrades.deployBeaconProxy(beacon, SimpleVault, [
        vaultName,
        vaultSymbol,
        token.address,
        [marketplace1.address, marketplace2.address],
        admin.address,
        constants.accounts.Dev,
        ethers.constants.AddressZero,
        treasury.address,
      ])
    ).to.be.revertedWithCustomError(SimpleVault, "InvalidAddress");

    await expect(
      upgrades.deployBeaconProxy(beacon, SimpleVault, [
        vaultName,
        vaultSymbol,
        token.address,
        [marketplace1.address, marketplace2.address],
        admin.address,
        constants.accounts.Dev,
        constants.accounts.Multisig,
        ethers.constants.AddressZero,
      ])
    ).to.be.revertedWithCustomError(SimpleVault, "InvalidAddress");

    vault = await upgrades.deployBeaconProxy(beacon, SimpleVault, [
      vaultName,
      vaultSymbol,
      token.address,
      [marketplace1.address, marketplace2.address],
      admin.address,
      constants.accounts.Dev,
      constants.accounts.Multisig,
      treasury.address,
    ]);

    defaultAdminRole = await vault.DEFAULT_ADMIN_ROLE();
    creatorRole = await vault.CREATOR_ROLE();
    assetReceiverRole = await vault.ASSET_RECEIVER_ROLE();
    liquidatorRole = await vault.LIQUIDATOR_ROLE();
    bidderRole = await vault.BIDDER_ROLE();
    whitelistRole = await vault.WHITELIST_ROLE();
    marketplaceRole = await vault.MARKETPLACE_ROLE();

    await vault.connect(dev).grantRole(defaultAdminRole, admin.address);
    await vault.connect(dev).setWithdrawalFees(700);
  });

  beforeEach(async () => {
    snapshotId = await takeSnapshot();
  });

  afterEach(async function () {
    await revertToSnapshot(snapshotId);
  });

  describe("Deployment", function () {
    it("Should set the correct name", async function () {
      expect(await vault.name()).to.equal(vaultName);
    });

    it("Should set the correct symbol", async function () {
      expect(await vault.symbol()).to.equal(vaultSymbol);
    });

    it("Should set the correct decimal", async function () {
      expect(await vault.decimals()).to.equal(await token.decimals());
    });

    it("Should set the correct asset", async function () {
      expect(await vault.asset()).to.equal(token.address);
    });

    it("Should set the correct role", async function () {
      await checkRole(admin.address, creatorRole, true);
      await checkRole(constants.accounts.Dev, defaultAdminRole, true);
      await checkRole(constants.accounts.Multisig, defaultAdminRole, true);
      await checkRole(constants.accounts.Multisig, assetReceiverRole, true);
      await checkRole(constants.accounts.Dev, liquidatorRole, true);
      await checkRole(constants.accounts.Dev, bidderRole, true);
      await checkRole(marketplace1.address, marketplaceRole, true);
      await checkRole(marketplace2.address, marketplaceRole, true);
    });

    it("Should set the correct implementation version", async function () {
      expect(await vault.IMPLEMENTATION_VERSION()).to.equal("1.1");
    });

    it("Should initialize once", async function () {
      await expect(
        vault.initialize(
          vaultName,
          vaultSymbol,
          token.address,
          [marketplace1.address, marketplace2.address],
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
        expect(await vault.convertToShares(0)).to.be.eq(0);
      });

      it("Non-zero assets when supply is zero", async function () {
        const assets = ethers.utils.parseEther("100");
        expect(await vault.convertToShares(assets)).to.be.eq(assets);
      });

      it("Non-zero assets when supply is non-zero", async function () {
        await vault.connect(admin).grantRole(whitelistRole, alice.address);
        const assets = ethers.utils.parseEther("100");
        await token.connect(alice).approve(vault.address, assets);
        await vault.connect(alice).deposit(assets, bob.address);

        expect(await vault.convertToShares(100)).to.be.eq(100);
      });
    });

    describe("convertToAssets", function () {
      it("Zero shares", async function () {
        expect(await vault.convertToAssets(0)).to.be.eq(0);
      });

      it("Non-zero shares when supply is zero", async function () {
        expect(await vault.convertToAssets(100)).to.be.eq(100);
      });

      it("Non-zero shares when supply is non-zero", async function () {
        await vault.connect(admin).grantRole(whitelistRole, alice.address);
        const assets = ethers.utils.parseEther("100");
        await token.connect(alice).approve(vault.address, assets);
        await vault.connect(alice).deposit(assets, bob.address);

        expect(await vault.convertToAssets(100)).to.be.eq(100);
      });
    });

    describe("previewDeposit", function () {
      it("Zero assets", async function () {
        expect(await vault.previewDeposit(0)).to.be.eq(0);
      });

      it("Non-zero assets when supply is zero", async function () {
        expect(await vault.previewDeposit(100)).to.be.eq(100);
      });

      it("Non-zero assets when supply is non-zero", async function () {
        await vault.connect(admin).grantRole(whitelistRole, alice.address);
        const assets = ethers.utils.parseEther("100");
        await token.connect(alice).approve(vault.address, assets);
        await vault.connect(alice).deposit(assets, bob.address);

        expect(await vault.previewDeposit(100)).to.be.eq(100);
      });
    });

    describe("previewMint", function () {
      it("Zero shares", async function () {
        expect(await vault.previewMint(0)).to.be.eq(0);
      });

      it("Non-zero shares when supply is zero", async function () {
        expect(await vault.previewMint(100)).to.be.eq(100);
      });

      it("Non-zero shares when supply is non-zero", async function () {
        await vault.connect(admin).grantRole(whitelistRole, alice.address);
        const assets = ethers.utils.parseEther("100");
        await token.connect(alice).approve(vault.address, assets);
        await vault.connect(alice).deposit(assets, bob.address);

        expect(await vault.previewMint(100)).to.be.eq(100);
      });
    });

    describe("previewWithdraw", function () {
      it("Zero assets", async function () {
        expect(await vault.previewWithdraw(0)).to.be.eq(0);
      });

      it("Non-zero assets when supply is zero", async function () {
        expect(await vault.previewWithdraw(9300)).to.be.eq(10000);
      });

      it("Non-zero assets when supply is non-zero", async function () {
        await vault.connect(admin).grantRole(whitelistRole, alice.address);
        const assets = ethers.utils.parseEther("100");
        await token.connect(alice).approve(vault.address, assets);
        await vault.connect(alice).deposit(assets, bob.address);

        expect(await vault.previewWithdraw(9300)).to.be.eq(10000);
      });
    });

    describe("previewRedeem", function () {
      it("Zero shares", async function () {
        expect(await vault.previewRedeem(0)).to.be.eq(0);
      });

      it("Non-zero shares when supply is zero", async function () {
        expect(await vault.previewRedeem(10000)).to.be.eq(9300);
      });

      it("Non-zero shares when supply is non-zero", async function () {
        await vault.connect(admin).grantRole(whitelistRole, alice.address);
        const assets = ethers.utils.parseEther("100");
        await token.connect(alice).approve(vault.address, assets);
        await vault.connect(alice).deposit(assets, bob.address);

        expect(await vault.previewRedeem(10000)).to.be.eq(9300);
      });
    });

    it("maxDeposit", async function () {
      expect(await vault.maxDeposit(admin.address)).to.be.eq(
        ethers.constants.MaxUint256
      );
    });

    it("maxMint", async function () {
      expect(await vault.maxMint(admin.address)).to.be.eq(
        ethers.constants.MaxUint256
      );
    });

    describe("maxWithdraw", function () {
      it("When balance is zero", async function () {
        expect(await vault.maxWithdraw(admin.address)).to.be.eq(0);
      });

      it("When balance is non-zero", async function () {
        await vault.connect(admin).grantRole(whitelistRole, alice.address);
        const assets = ethers.utils.parseEther("100");
        await token.connect(alice).approve(vault.address, assets);
        await vault.connect(alice).deposit(assets, alice.address);

        expect(await vault.maxWithdraw(alice.address)).to.be.eq(
          assets.mul(9300).div(10000)
        );
      });
    });

    describe("maxRedeem", function () {
      it("When balance is zero", async function () {
        expect(await vault.maxRedeem(admin.address)).to.be.eq(0);
      });

      it("When balance is non-zero", async function () {
        await vault.connect(admin).grantRole(whitelistRole, alice.address);
        const assets = ethers.utils.parseEther("100");
        await token.connect(alice).approve(vault.address, assets);
        await vault.connect(alice).deposit(assets, alice.address);

        expect(await vault.maxRedeem(alice.address)).to.be.eq(
          assets.mul(9300).div(10000)
        );
      });
    });
  });

  describe("User Actions", function () {
    describe("Deposit", function () {
      it("When user is not whitelisted", async function () {
        await vault.connect(admin).grantRole(whitelistRole, bob.address);
        await token.connect(alice).approve(vault.address, ethers.constants.MaxUint256);
        await expect(
          vault
            .connect(alice)
            .deposit(ethers.utils.parseEther("100"), alice.address)
        ).to.be.revertedWithCustomError(vault, "NotWhitelisted");
      });

      describe("When user is whitelisted", function () {
        beforeEach(async function () {
          await vault.connect(admin).grantRole(whitelistRole, alice.address);
          await vault.connect(admin).grantRole(whitelistRole, bob.address);
          await vault.connect(admin).grantRole(whitelistRole, carol.address);
          await vault.connect(admin).grantRole(whitelistRole, dave.address);

          await checkRole(alice.address, whitelistRole, true);
          await checkRole(bob.address, whitelistRole, true);
          await checkRole(carol.address, whitelistRole, true);
          await checkRole(dave.address, whitelistRole, true);
        });

        it("When paused", async function () {
          await vault.connect(admin).pause();
          expect(await vault.paused()).to.be.eq(true);

          const assets = ethers.utils.parseEther("100");

          await expect(
            vault.connect(alice).deposit(assets, alice.address)
          ).to.be.revertedWith("Pausable: paused");
        });

        it("When deposits 0 assets", async function () {
          await expect(
            vault.connect(alice).deposit(0, alice.address)
          ).to.be.revertedWithCustomError(vault, "ParameterOutOfBounds");
        });

        it("When asset is not approved", async function () {
          const assets = ethers.utils.parseEther("100");

          await expect(
            vault.connect(alice).deposit(assets, alice.address)
          ).to.be.revertedWith("ERC20: insufficient allowance");
        });

        it("When balance is not enough", async function () {
          const assets = await token.balanceOf(alice.address);
          await token.connect(alice).approve(vault.address, assets.add(1));

          await expect(
            vault.connect(alice).deposit(assets.add(1), alice.address)
          ).to.be.revertedWith("ERC20: transfer amount exceeds balance");
        });

        it("Take assets and mint shares", async function () {
          const assets = ethers.utils.parseEther("100");
          const shares = await vault.previewDeposit(assets);

          await token.connect(alice).approve(vault.address, assets);

          const beforeAssetBalance = await token.balanceOf(alice.address);
          const beforeShareBalance = await vault.balanceOf(bob.address);

          const tx = await vault.connect(alice).deposit(assets, bob.address);

          expect(await vault.balanceOf(bob.address)).to.be.eq(
            beforeShareBalance.add(shares)
          );
          expect(await token.balanceOf(alice.address)).to.be.eq(
            beforeAssetBalance.sub(assets)
          );

          await expect(tx)
            .to.emit(vault, "Deposit")
            .withArgs(alice.address, bob.address, assets, shares);
          await expect(tx)
            .to.emit(vault, "Transfer")
            .withArgs(ethers.constants.AddressZero, bob.address, shares);
          await expect(tx)
            .to.emit(token, "Transfer")
            .withArgs(alice.address, vault.address, assets);

          expect(await vault.totalAssets()).to.be.eq(assets);
        });

        it("Multi users deposit", async function () {
          const users = [alice, bob, carol];
          const amounts = [
            ethers.utils.parseEther("100"),
            ethers.utils.parseEther("200"),
            ethers.utils.parseEther("500"),
          ];

          // approve
          for (let i = 0; i < users.length; i++) {
            await token.connect(users[i]).approve(vault.address, amounts[i]);
          }

          let totalAssets = ethers.constants.Zero;

          // deposit
          for (i = 0; i < users.length; i++) {
            const user = users[i];
            const assets = amounts[i];
            totalAssets = totalAssets.add(assets);
            const shares = await vault.previewDeposit(assets);

            const beforeAssetBalance = await token.balanceOf(user.address);
            const beforeShareBalance = await vault.balanceOf(user.address);

            const tx = await vault.connect(user).deposit(assets, user.address);

            expect(await vault.balanceOf(user.address)).to.be.eq(
              beforeShareBalance.add(shares)
            );
            expect(await token.balanceOf(user.address)).to.be.eq(
              beforeAssetBalance.sub(assets)
            );

            await expect(tx)
              .to.emit(vault, "Deposit")
              .withArgs(user.address, user.address, assets, shares);
            await expect(tx)
              .to.emit(vault, "Transfer")
              .withArgs(ethers.constants.AddressZero, user.address, shares);
            await expect(tx)
              .to.emit(token, "Transfer")
              .withArgs(user.address, vault.address, assets);
          }

          expect(await vault.totalAssets()).to.be.eq(totalAssets);
        });
      });
    });

    describe("Mint", function () {
      it("When user is not whitelisted", async function () {
        await vault.connect(admin).grantRole(whitelistRole, bob.address);
        await token.connect(alice).approve(vault.address, ethers.constants.MaxUint256);
        await expect(
          vault
            .connect(alice)
            .mint(ethers.utils.parseEther("100"), alice.address)
        ).to.be.revertedWithCustomError(vault, "NotWhitelisted");
      });

      describe("When user is whitelisted", function () {
        beforeEach(async function () {
          await vault.connect(admin).grantRole(whitelistRole, alice.address);
          await vault.connect(admin).grantRole(whitelistRole, bob.address);
          await vault.connect(admin).grantRole(whitelistRole, carol.address);
          await vault.connect(admin).grantRole(whitelistRole, dave.address);

          await checkRole(alice.address, whitelistRole, true);
          await checkRole(bob.address, whitelistRole, true);
          await checkRole(carol.address, whitelistRole, true);
          await checkRole(dave.address, whitelistRole, true);
        });

        it("When paused", async function () {
          await vault.connect(admin).pause();
          expect(await vault.paused()).to.be.eq(true);

          const shares = ethers.utils.parseEther("100");

          await expect(
            vault.connect(alice).mint(shares, alice.address)
          ).to.be.revertedWith("Pausable: paused");
        });

        it("When mints 0 shares", async function () {
          await expect(
            vault.connect(alice).mint(0, alice.address)
          ).to.be.revertedWithCustomError(vault, "ParameterOutOfBounds");
        });

        it("When asset is not approved", async function () {
          const shares = ethers.utils.parseEther("100");

          await expect(
            vault.connect(alice).mint(shares, alice.address)
          ).to.be.revertedWith("ERC20: insufficient allowance");
        });

        it("When balance is not enough", async function () {
          const shares = await token.balanceOf(alice.address);
          await token.connect(alice).approve(vault.address, shares.add(1));

          await expect(
            vault.connect(alice).mint(shares.add(1), alice.address)
          ).to.be.revertedWith("ERC20: transfer amount exceeds balance");
        });

        it("Take assets and mint shares", async function () {
          const shares = ethers.utils.parseEther("100");
          const assets = await vault.previewMint(shares);

          await token.connect(alice).approve(vault.address, assets);

          const beforeAssetBalance = await token.balanceOf(alice.address);
          const beforeShareBalance = await vault.balanceOf(bob.address);

          const tx = await vault.connect(alice).mint(shares, bob.address);

          expect(await vault.balanceOf(bob.address)).to.be.eq(
            beforeShareBalance.add(shares)
          );
          expect(await token.balanceOf(alice.address)).to.be.eq(
            beforeAssetBalance.sub(assets)
          );

          await expect(tx)
            .to.emit(vault, "Deposit")
            .withArgs(alice.address, bob.address, assets, shares);
          await expect(tx)
            .to.emit(vault, "Transfer")
            .withArgs(ethers.constants.AddressZero, bob.address, shares);
          await expect(tx)
            .to.emit(token, "Transfer")
            .withArgs(alice.address, vault.address, assets);

          expect(await vault.totalAssets()).to.be.eq(assets);
        });

        it("Multi users mint", async function () {
          const users = [alice, bob, carol];
          const amounts = [
            ethers.utils.parseEther("100"),
            ethers.utils.parseEther("200"),
            ethers.utils.parseEther("500"),
          ];

          // approve
          for (let i = 0; i < users.length; i++) {
            await token.connect(users[i]).approve(vault.address, amounts[i]);
          }

          let totalAssets = ethers.constants.Zero;

          // deposit
          for (i = 0; i < users.length; i++) {
            const user = users[i];
            const shares = amounts[i];
            const assets = await vault.previewMint(shares);
            totalAssets = totalAssets.add(assets);

            const beforeAssetBalance = await token.balanceOf(user.address);
            const beforeShareBalance = await vault.balanceOf(user.address);

            const tx = await vault.connect(user).mint(assets, user.address);

            expect(await vault.balanceOf(user.address)).to.be.eq(
              beforeShareBalance.add(shares)
            );
            expect(await token.balanceOf(user.address)).to.be.eq(
              beforeAssetBalance.sub(assets)
            );

            await expect(tx)
              .to.emit(vault, "Deposit")
              .withArgs(user.address, user.address, assets, shares);
            await expect(tx)
              .to.emit(vault, "Transfer")
              .withArgs(ethers.constants.AddressZero, user.address, shares);
            await expect(tx)
              .to.emit(token, "Transfer")
              .withArgs(user.address, vault.address, assets);
          }

          expect(await vault.totalAssets()).to.be.eq(totalAssets);
        });
      });
    });

    describe("Withdraw", function () {
      beforeEach(async function () {
        await vault.connect(admin).grantRole(whitelistRole, alice.address);

        const assets = ethers.utils.parseEther("100");
        await token.connect(alice).approve(vault.address, assets);
        await vault.connect(alice).deposit(assets, alice.address);
      });

      it("When paused", async function () {
        await vault.connect(admin).pause();
        expect(await vault.paused()).to.be.eq(true);

        const assets = ethers.utils.parseEther("100");

        await expect(
          vault.connect(alice).withdraw(assets, alice.address, alice.address)
        ).to.be.revertedWith("Pausable: paused");
      });

      it("When receiver is 0x0", async function () {
        await expect(
          vault
            .connect(alice)
            .withdraw(0, ethers.constants.AddressZero, alice.address)
        ).to.be.revertedWithCustomError(vault, "InvalidAddress");
      });

      it("When withdraw 0 amount", async function () {
        await expect(
          vault.connect(alice).withdraw(0, bob.address, alice.address)
        ).to.be.revertedWithCustomError(vault, "ParameterOutOfBounds");
      });

      it("When allowance is not enough", async function () {
        const assets = ethers.utils.parseEther("50");

        await expect(
          vault.connect(bob).withdraw(assets, bob.address, alice.address)
        ).to.be.revertedWith("ERC20: insufficient allowance");
      });

      it("When share balance is not enough", async function () {
        const assets = ethers.utils.parseEther("100");

        await expect(
          vault.connect(alice).withdraw(assets, bob.address, alice.address)
        ).to.be.revertedWith("ERC20: burn amount exceeds balance");
      });

      it("Withdraw assets", async function () {
        const assets = ethers.utils.parseEther("50");
        const shares = await vault.previewWithdraw(assets);
        expect(shares).to.be.eq(assets.mul(10000).div(9300));
        const fees = shares.sub(await vault.convertToShares(assets));

        const beforeFeeBalance1 = await token.balanceOf(treasury.address);
        const beforeFeeBalance2 = await token.balanceOf(
          constants.accounts.Multisig
        );
        const beforeAssetBalance = await token.balanceOf(bob.address);
        const beforeShareBalance = await vault.balanceOf(alice.address);

        await vault.connect(alice).withdraw(assets, bob.address, alice.address);

        const afterFeeBalance1 = await token.balanceOf(treasury.address);
        const afterFeeBalance2 = await token.balanceOf(
          constants.accounts.Multisig
        );
        const afterAssetBalance = await token.balanceOf(bob.address);
        const afterShareBalance = await vault.balanceOf(alice.address);

        expect(afterFeeBalance1).to.be.closeTo(
          beforeFeeBalance1.add(fees.div(2)),
          1
        );
        expect(afterFeeBalance2).to.be.closeTo(
          beforeFeeBalance2.add(fees.div(2)),
          1
        );
        expect(afterAssetBalance).to.be.eq(beforeAssetBalance.add(assets));
        expect(beforeShareBalance).to.be.eq(afterShareBalance.add(shares));
      });
    });

    describe("Redeem", function () {
      beforeEach(async function () {
        await vault.connect(admin).grantRole(whitelistRole, alice.address);

        const assets = ethers.utils.parseEther("100");
        await token.connect(alice).approve(vault.address, assets);
        await vault.connect(alice).deposit(assets, alice.address);
      });

      it("When paused", async function () {
        await vault.connect(admin).pause();
        expect(await vault.paused()).to.be.eq(true);

        const assets = ethers.utils.parseEther("100");

        await expect(
          vault.connect(alice).redeem(assets, alice.address, alice.address)
        ).to.be.revertedWith("Pausable: paused");
      });

      it("When receiver is 0x0", async function () {
        await expect(
          vault
            .connect(alice)
            .redeem(0, ethers.constants.AddressZero, alice.address)
        ).to.be.revertedWithCustomError(vault, "InvalidAddress");
      });

      it("When redeem 0 amount", async function () {
        await expect(
          vault.connect(alice).redeem(0, bob.address, alice.address)
        ).to.be.revertedWithCustomError(vault, "ParameterOutOfBounds");
      });

      it("When allowance is not enough", async function () {
        const shares = ethers.utils.parseEther("50");

        await expect(
          vault.connect(bob).redeem(shares, bob.address, alice.address)
        ).to.be.revertedWith("ERC20: insufficient allowance");
      });

      it("When share balance is not enough", async function () {
        const shares = ethers.utils.parseEther("101");

        await expect(
          vault.connect(alice).redeem(shares, bob.address, alice.address)
        ).to.be.revertedWith("ERC20: burn amount exceeds balance");
      });

      it("Redeem shares", async function () {
        const shares = ethers.utils.parseEther("50");
        const assets = await vault.previewRedeem(shares);
        expect(assets).to.be.eq(shares.mul(9300).div(10000));
        const fees = (await vault.convertToAssets(shares)).sub(assets);

        const beforeFeeBalance1 = await token.balanceOf(treasury.address);
        const beforeFeeBalance2 = await token.balanceOf(
          constants.accounts.Multisig
        );
        const beforeAssetBalance = await token.balanceOf(bob.address);
        const beforeShareBalance = await vault.balanceOf(alice.address);

        await vault.connect(alice).redeem(shares, bob.address, alice.address);

        const afterFeeBalance1 = await token.balanceOf(treasury.address);
        const afterFeeBalance2 = await token.balanceOf(
          constants.accounts.Multisig
        );
        const afterAssetBalance = await token.balanceOf(bob.address);
        const afterShareBalance = await vault.balanceOf(alice.address);

        expect(afterFeeBalance1).to.be.closeTo(
          beforeFeeBalance1.add(fees.div(2)),
          1
        );
        expect(afterFeeBalance2).to.be.closeTo(
          beforeFeeBalance2.add(fees.div(2)),
          1
        );
        expect(afterAssetBalance).to.be.eq(beforeAssetBalance.add(assets));
        expect(beforeShareBalance).to.be.eq(afterShareBalance.add(shares));
      });
    });
  });

  describe("Admin Actions", function () {
    it("Set withdrawal fees", async function () {
      await expect(
        vault.connect(alice).setWithdrawalFees(1000)
      ).to.be.revertedWith(
        `AccessControl: account ${alice.address.toLowerCase()} is missing role ${defaultAdminRole}`
      );

      await expect(
        vault.connect(admin).setWithdrawalFees(10001)
      ).to.be.revertedWithCustomError(vault, "ParameterOutOfBounds");

      const tx = await vault.connect(admin).setWithdrawalFees(1000);

      await expect(tx)
        .to.emit(vault, "WithdrawalFeeRateUpdated")
        .withArgs(1000);
    });

    it("Set Fee Recipient", async function () {
      await expect(
        vault.connect(alice).setFeeRecipient(dave.address)
      ).to.be.revertedWith(
        `AccessControl: account ${alice.address.toLowerCase()} is missing role ${defaultAdminRole}`
      );

      await expect(
        vault.connect(admin).setFeeRecipient(ethers.constants.AddressZero)
      ).to.be.revertedWithCustomError(vault, "InvalidAddress");

      const tx = await vault.connect(admin).setFeeRecipient(dave.address);

      await expect(tx)
        .to.emit(vault, "FeeRecipientUpdated")
        .withArgs(dave.address);
      expect(await vault.feeRecipient()).to.be.eq(dave.address);
    });

    it("Set Dev", async function () {
      await expect(
        vault.connect(alice).setDev(dave.address)
      ).to.be.revertedWith(
        `AccessControl: account ${alice.address.toLowerCase()} is missing role ${defaultAdminRole}`
      );

      await expect(
        vault.connect(admin).setDev(ethers.constants.AddressZero)
      ).to.be.revertedWithCustomError(vault, "InvalidAddress");

      const tx = await vault.connect(admin).setDev(dave.address);

      await expect(tx).to.emit(vault, "DevUpdated").withArgs(dave.address);
      expect(await vault.dev()).to.be.eq(dave.address);

      await checkRole(constants.accounts.Dev, defaultAdminRole, false);
      await checkRole(constants.accounts.Dev, liquidatorRole, false);
      await checkRole(constants.accounts.Dev, bidderRole, false);
      await checkRole(dave.address, defaultAdminRole, true);
      await checkRole(dave.address, liquidatorRole, true);
      await checkRole(dave.address, bidderRole, true);
    });

    it("Set Multisig", async function () {
      await expect(
        vault.connect(alice).setMultisig(dave.address)
      ).to.be.revertedWith(
        `AccessControl: account ${alice.address.toLowerCase()} is missing role ${defaultAdminRole}`
      );

      await expect(
        vault.connect(admin).setMultisig(ethers.constants.AddressZero)
      ).to.be.revertedWithCustomError(vault, "InvalidAddress");

      const tx = await vault.connect(admin).setMultisig(dave.address);

      await expect(tx).to.emit(vault, "MultisigUpdated").withArgs(dave.address);
      expect(await vault.multisig()).to.be.eq(dave.address);

      await checkRole(constants.accounts.Multisig, defaultAdminRole, false);
      await checkRole(constants.accounts.Multisig, assetReceiverRole, false);
      await checkRole(dave.address, defaultAdminRole, true);
      await checkRole(dave.address, assetReceiverRole, true);
    });

    it("Set total assets", async function () {
      const totalAssets = ethers.utils.parseEther("1000");
      await expect(
        vault.connect(alice).setTotalAssets(totalAssets)
      ).to.be.revertedWith(
        `AccessControl: account ${alice.address.toLowerCase()} is missing role ${defaultAdminRole}`
      );

      const tx = await vault.connect(dev).setTotalAssets(totalAssets);

      await expect(tx).to.emit(vault, "TotalAssets").withArgs(totalAssets);

      expect(await vault.totalAssets()).to.be.eq(totalAssets);
    });

    it("Pause", async function () {
      await expect(vault.connect(alice).pause()).to.be.revertedWith(
        `AccessControl: account ${alice.address.toLowerCase()} is missing role ${defaultAdminRole}`
      );

      expect(await vault.paused()).to.be.eq(false);

      const tx = await vault.connect(admin).pause();

      await expect(tx).to.emit(vault, "Paused").withArgs(admin.address);

      expect(await vault.paused()).to.be.eq(true);
    });

    it("Unpause", async function () {
      await vault.connect(admin).pause();

      await expect(vault.connect(alice).unpause()).to.be.revertedWith(
        `AccessControl: account ${alice.address.toLowerCase()} is missing role ${defaultAdminRole}`
      );

      expect(await vault.paused()).to.be.eq(true);

      const tx = await vault.connect(admin).unpause();

      await expect(tx).to.emit(vault, "Unpaused").withArgs(admin.address);

      expect(await vault.paused()).to.be.eq(false);
    });

    describe("Approve Asset", function () {
      it("When msg.sender does not have enough role", async function () {
        await expect(vault.connect(alice).approveAsset(marketplace1.address, 0))
          .to.be.reverted;
      });

      it("When spender do not have marketplace role", async function () {
        await expect(
          vault.connect(admin).approveAsset(alice.address, 0)
        ).to.be.revertedWith(
          `AccessControl: account ${alice.address.toLowerCase()} is missing role ${marketplaceRole}`
        );
      });

      it("Admin approves asset", async function () {
        const amount = ethers.utils.parseEther("100");
        await vault.connect(admin).approveAsset(marketplace1.address, amount);

        const allowance = await token.allowance(
          vault.address,
          marketplace1.address
        );
        expect(allowance).to.be.eq(amount);
      });

      it("Bidder approves asset", async function () {
        const amount = ethers.utils.parseEther("100");
        await vault.connect(dev).approveAsset(marketplace1.address, amount);

        const allowance = await token.allowance(
          vault.address,
          marketplace1.address
        );
        expect(allowance).to.be.eq(amount);
      });
    });
  });

  describe("ERC-1271", function () {
    it("When signature is invalid #1", async function () {
      const hash = ethers.utils.keccak256(
        ethers.utils.toUtf8Bytes("random string")
      );
      const magicValue = await vault.isValidSignature(hash, INVALID_SIGNATURE1);
      expect(magicValue).to.be.eq("0xffffffff");
    });

    it("When signature is invalid #2", async function () {
      const hash = ethers.utils.keccak256(
        ethers.utils.toUtf8Bytes("random string")
      );
      const magicValue = await vault.isValidSignature(hash, INVALID_SIGNATURE2);
      expect(magicValue).to.be.eq("0xffffffff");
    });

    it("When signature is invalid #3", async function () {
      const [hash, signature] = await signTestHashAndSignature(alice);
      const magicValue = await vault.isValidSignature(hash, signature);
      expect(magicValue).to.be.eq("0xffffffff");
    });

    it("When signature is valid", async function () {
      const [hash, signature] = await signTestHashAndSignature(admin);
      const magicValue = await vault.isValidSignature(hash, signature);
      expect(magicValue).to.be.eq("0x1626ba7e");
    });
  });
});
