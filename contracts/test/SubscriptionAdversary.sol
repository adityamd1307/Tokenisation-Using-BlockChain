// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../AssetToken.sol";

/// @dev Deliberately unsafe test currency; never deployed by application scripts.
contract AdversarialUSD is ERC20 {
    uint8 public mode;
    address public callbackTarget;
    bytes public callbackData;
    bool public callbackSucceeded;
    bytes public callbackResult;
    constructor() ERC20("Adversarial test currency", "BAD") {}
    function decimals() public pure override returns(uint8) { return 6; }
    function mint(address to,uint256 amount) external { _mint(to,amount); }
    function destroy(address from,uint256 amount) external { _burn(from,amount); }
    function configure(uint8 mode_,address target,bytes calldata data) external { mode=mode_;callbackTarget=target;callbackData=data; }
    function transfer(address to,uint256 amount) public override returns(bool) {
        if(mode==2)return false;
        require(mode!=3,"test transfer failure");
        super.transfer(to,amount);
        _after(to);
        if(mode==5)assembly { return(0,0) }
        return true;
    }
    function transferFrom(address from,address to,uint256 amount) public override returns(bool) {
        if(mode==2)return false;
        require(mode!=3,"test transfer failure");
        super.transferFrom(from,to,amount);
        _after(to);
        if(mode==5)assembly { return(0,0) }
        return true;
    }
    function _after(address to) private {
        if(mode==1)_burn(to,1);
        if(mode==4)(callbackSucceeded,callbackResult)=callbackTarget.call(callbackData);
    }
}

contract SubscriptionActor {
    function execute(address target,bytes calldata data) external {
        (bool ok,bytes memory result)=target.call(data);
        if(!ok)assembly { revert(add(result,32),mload(result)) }
    }
}

/// @dev Interface-compatible adversarial asset; the production AssetToken is unchanged.
contract CallbackAssetToken is ERC20 {
    address public immutable issuer;
    mapping(address => bool) public isWhitelisted;
    address public callbackTarget;
    bytes public callbackData;
    bool public callbackSucceeded;
    bytes public callbackResult;
    constructor(address issuer_) ERC20("Callback test asset","CB") { issuer=issuer_;isWhitelisted[issuer_]=true;_mint(issuer_,10000); }
    function decimals() public pure override returns(uint8) { return 0; }
    function setWhitelisted(address who,bool eligible) external { require(msg.sender==issuer);isWhitelisted[who]=eligible; }
    function forcedTransfer(address from,address to,uint256 amount) external { require(msg.sender==issuer && !isWhitelisted[from] && isWhitelisted[to]);super._update(from,to,amount); }
    function configure(address target,bytes calldata data) external {callbackTarget=target;callbackData=data;}
    function _update(address from,address to,uint256 value) internal override {
        require((from==address(0)||isWhitelisted[from]) && (to==address(0)||isWhitelisted[to]));
        super._update(from,to,value);
        if(callbackTarget!=address(0))(callbackSucceeded,callbackResult)=callbackTarget.call(callbackData);
    }
}
