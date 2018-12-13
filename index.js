var request = require("request");


var Accessory, Service, Characteristic, UUIDGen;

module.exports = function(homebridge) {
  console.log("homebridge API version: " + homebridge.version);

  // Accessory must be created from PlatformAccessory Constructor
  Accessory = homebridge.platformAccessory;

  // Service and Characteristic are from hap-nodejs
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  UUIDGen = homebridge.hap.uuid;
  
  // For platform plugin to be considered as dynamic platform plugin,
  // registerPlatform(pluginName, platformName, constructor, dynamic), dynamic must be true
  homebridge.registerPlatform('homebridge-homewizard-lite', 'HomeWizard-Lite', SamplePlatform, true);
}
// Platform constructor
// config may be null
// api may be null if launched from old homebridge version
function SamplePlatform(log, config, api) {
  log("SamplePlatform Init");
  var platform = this;
  this.log = log;
  this.config = config;
  this.accessories = [];

  if (api) {
      // Save the API object as plugin needs to register new accessory via this object
      this.api = api;

      // Listen to event "didFinishLaunching", this means homebridge already finished loading cached accessories.
      // Platform Plugin should only register new accessory that doesn't exist in homebridge after this event.
      // Or start discover new accessories.
      this.api.on('didFinishLaunching', function() {
        platform.log("DidFinishLaunching");

        new AccessoryFactory(log, config, api);
        //this.addAccessory("test");
      }.bind(this));
      console.log("loaded")
  }
}

// Function invoked when homebridge tries to restore cached accessory.
// Developer can configure accessory at here (like setup event handler).
// Update current value.
SamplePlatform.prototype.configureAccessory = function(accessory) {

}

// Sample function to show how developer can add accessory dynamically from outside event
SamplePlatform.prototype.addAccessory = function(accessoryName) {
}

SamplePlatform.prototype.updateAccessoriesReachability = function() {
  this.log("Update Reachability");
  for (var index in this.accessories) {
    var accessory = this.accessories[index];
    accessory.updateReachability(false);
  }
}

// Sample function to show how developer can remove accessory dynamically from outside event
SamplePlatform.prototype.removeAccessory = function() {
  this.log("Remove Accessory");
  this.api.unregisterPlatformAccessories("homebridge-samplePlatform", "SamplePlatform", this.accessories);

  this.accessories = [];
}

function findPlugId(body, pluginName, deviceName) {
  var pluginId, deviceId;
  body.forEach(plug => {
    if(plug.name === pluginName) {
      pluginId = plug.id;
      deviceId = findDeviceId(plug, deviceName);
    }
  });
  return [pluginId, deviceId];
}

function findDeviceId(body, deviceName) {
  var deviceId;
  body.devices.forEach(device => {
    if(device.name === deviceName) {
      deviceId = device.id;
    }
  });
  return deviceId;
}


  function AccessoryFactory(log, config, api) {
    this.log = log;
    this.config = config;
    this.api = api;


    config.lightBulbs.forEach(lightBulb => {
      this.createAccessory(lightBulb.displayName, lightBulb.plugId, lightBulb.deviceId);

    })
  }

  AccessoryFactory.prototype.createAccessory = function(accessoryName, pluginId, deviceId) {
    this.log("Add Accessory");
    var platform = this;
    var uuid;
    uuid = UUIDGen.generate(accessoryName);
    var newAccessory = new Accessory(accessoryName, uuid);
    newAccessory.on('identify', function (paired, callback) {
      platform.log(newAccessory.displayName, "Identify!!!");
      callback();
    });
    // Plugin can save context on accessory to help restore accessory in configureAccessory()
    // newAccessory.context.something = "Something"
    // Make sure you provided a name for service, otherwise it may not visible in some HomeKit apps
    newAccessory.addService(Service.Lightbulb, accessoryName)
      .getCharacteristic(Characteristic.On)
      .on('set', function (value, callback) {
        platform.log(newAccessory.displayName, "Light -> " + value);
        var action;
        if (value) {
          action = "On";
        }
        else {
          action = "Off";
        }
        var sessionId;
        request('https://cloud.homewizard.com/account/login', {
          method: "GET",
          auth: {
            user: "stefvg1993@gmail.com",
            pass: "a806b95c52df611c188d35daf7518a3964f342a3"
          }
        }, function (error, response, body) {
          if (!error && response.statusCode == 200) {
            sessionId = JSON.parse(body).session;
            const allPlugsUrl = 'https://plug.homewizard.com/plugs';
            request({
              url: allPlugsUrl,
              method: "GET",
              headers: {
                'X-Session-Token': sessionId
              }
            }, function (error, response, body) {
              if (error) {
                callback("Error occured: " + error);
              }
              const plugAndDeviceId = findPlugId(JSON.parse(body), pluginId, deviceId);
              if(!plugAndDeviceId[0] || !plugAndDeviceId[1]) {
                callback("Error: plug or device not found, make sure this is ok.")
              }
              const actionUrl = "https://plug.homewizard.com/plugs/" + plugAndDeviceId[0] + "/devices/" + plugAndDeviceId[1] + "/action";
              request({
                url: actionUrl,
                method: "POST",
                headers: {
                  'X-Session-Token': sessionId,
                  'Content-Type': 'application/json; charset=utf-8'
                },
                body: '{"action": "' + action + '"}'
              }, function (error, response, body) {
                if (error) {
                  callback("Error occured: " + error);
                }
                else {
                  callback();
                }
              });
            });
          }
          else {
            callback("Error occured: " + error);
          }
        });
      });
    this.api.registerPlatformAccessories("homebridge-samplePlatform", "SamplePlatform", [newAccessory]);
  }
