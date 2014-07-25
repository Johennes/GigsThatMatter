(function($) {
  
  $.lastfmAPI = function(APIKey) {
    
    var baseURL = 'https://ws.audioscrobbler.com/2.0/';
    var URLTail = '&api_key=' + APIKey + '&format=json&callback=?';
    
    
    var buildURL = function(options) {
      var URL = baseURL;
      
      if (options.method == undefined) return null
      
      URL += '?method=' + options.method;
      
      for (option in options) {
        if (option == 'method') continue;
        
        URL += '&' + option + '=' + options[option];
      }
      
      URL += URLTail;
      
      return URL
    }
    
    
    var isArray = function(object) {
      if (Object.prototype.toString.call(object) === '[object Array]') {
        return true;
      } else {
        return false;
      }
    }
    
    
    var User = function(jsonData) {
      this.id   = jsonData.id;
      this.name = jsonData.name;
    }
    
    
    var Artist = function(jsonData) {
      this.mbid = jsonData.mbid;
      this.name = jsonData.name;
    }
    
    
    var Venue = function(jsonData) {
      this.id        = jsonData.id;
      this.name      = jsonData.name;
      this.street    = jsonData.location.street;
      this.zip       = jsonData.location.postalcode;
      this.city      = jsonData.location.city;
      this.country   = jsonData.location.country;
      this.latitude  = parseFloat(jsonData.location['geo:point']['geo:lat']);
      this.longitude = parseFloat(jsonData.location['geo:point']['geo:long']);
    }
    
    
    var Event = function(jsonData) {
      this.id        = jsonData.id;
      this.name      = jsonData.title;
      this.startDate = new Date(jsonData.startDate);
      this.endDate   = new Date(jsonData.endDate);
      this.canceled  = (jsonData.cancelled == 0) ? false : true;
      
      this.headliner = jsonData.artists.headliner;
      
      if (isArray(jsonData.artists.artist)) {
        this.artists = jsonData.artists.artist;
      } else {
        this.artists = new Array(jsonData.artists.artist);
      }
      
      this.venue = new Venue(jsonData.venue);
    }
    
    
    this.getUserInfo = function(username, callback) {
      var URL = buildURL({
        'method': 'user.getinfo',
        'user'  : username
      });
      
      $.getJSON(URL, function(data) {
        var info = null;
        
        if (data.user) {
          info = new User(data.user);
        }
        
        callback(info);
        return;
      });
    }
    
    
    this.getTopArtists = function(username, limit, callback) {
      var URL = buildURL({
        'method': 'user.gettopartists',
        'user'  : username,
        'limit' : limit
      });
      
      $.getJSON(URL, function(data) {
        var artists = new Array();
        
        if (data.topartists && data.topartists.artist) {
          $.each(data.topartists.artist, function(i, artistData){
            artists.push(new Artist(artistData));
          });
        }
        
        callback(artists);
        return;
      });
    };
    
    
    this.getEvents = function(mbid, callback) {
      var URL = buildURL({
        'method': 'artist.getEvents',
        'mbid'  : mbid
      });
      
      $.getJSON(URL, function(data) {
        var events = new Array();
        
        if (data.events && parseInt(data.events.total) !== 0) {
          if (! isArray(data.events.event)) {
            data.events.event = new Array(data.events.event);
          }
          
          $.each(data.events.event, function(i, eventData) {
            var event = new Event(eventData);
            
            if (event.venue.latitude || event.venue.longitude) {
              events.push(event);
            }
          });
        }
        
        callback(mbid, events);
        
        return;
      });
    };
    
  };
 
}(jQuery));
