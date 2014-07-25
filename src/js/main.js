(function($) {
    
    var lastfm              = new $.lastfmAPI('48f87ba2293a969db53d32a09ac83c96');
    var locationInput       = null;
    var map                 = null;
    var markers             = new Array();
    var infoWindow          = null;
    var artists             = null;
    var numArtists          = null;
    var numArtistsProcessed = null;
    var sizeReceiver        = null;
    var sizeReceiverOrigin  = null;

    $(document).ready(function() {
        
        if (window.parent && window.parent.postMessage) {
          window.parent.postMessage($('body').outerHeight(true) + 'px', '*');
        }
        
        window.addEventListener('message', handleMessageEvent, false);
        
        $('.expander').click(handleMenuClick);
        
        initLocationInput();
        initMaxArtistsSlider();
        initMap();
        
        $('form#settings').submit(handleFormSubmission);
    });
    
    
    function handleMessageEvent(event) {
      sizeReceiver       = event.source;
      sizeReceiverOrigin = event.origin;
      
      publishSize();
    }
    
    
    function publishSize() {
      if (! sizeReceiver || ! sizeReceiverOrigin) {
        return;
      }
      
      sizeReceiver.postMessage($('body').outerHeight(true) + 'px', sizeReceiverOrigin);
    }
    
    
    function handleMenuClick(event) {
      var toggle = function(listElement, callback) {
        listElement.toggleClass('expanded');
        listElement.find('.expandable').slideToggle('slow', callback);
      }
      
      var previous = $('ul#menu > li.expanded');
      var current  = $(this).parent();
      
      if (previous.length && previous[0] != current[0]) {
        toggle(previous, function() {
          toggle(current);
        });
      } else {
        toggle(current);
      }
      
      event.preventDefault();
    }
    
    
    function initLocationInput() {
        locationInput = new google.maps.places.Autocomplete(
            document.getElementById('location'), { types: ['(cities)'] });
        
        google.maps.event.addListener(locationInput, 'place_changed', function() {
            if (map && validateLocation()) {
                map.setOptions(getMapOptionsForRepositioning());
            }
        });
    }
    
    
    function initMaxArtistsSlider() {
        $('#max_artists').slider({
            range:   'min',
            min:     10,
            max:     100,
            step:    10,
            value:   30,
            create:  updateMaxArtistsSliderValue,
            slide:   updateMaxArtistsSliderValue,
            animate: 'fast'
        });

        updateMaxArtistsSliderValue();
    }


    function updateMaxArtistsSliderValue(event, ui) {
        var value = (ui !== undefined && ui && ui.value) ? ui.value : $('#max_artists').slider('value');
        $('#max_artists_value').html(value);
    }
    
    
    function initMap() {
        if (!map) {
            var mapOptions = getMapOptionsForRepositioning();
            
            map = new google.maps.Map(document.getElementById('map_wrapper'), mapOptions);
            
            google.maps.event.addListener(map, 'click', handleMapClick);
        } else {
            for (var i = 0; i < markers.length; ++i) {
                markers[i].setMap(null);
            }
            markers = [];
        }
    }
    
    
    function initLists() {
        initArtistList();
        initEventList(false);
        
        $('#list_wrapper').fadeIn();
    }
    
    
    function initArtistList() {
        $('#artist_list li:not(.artist_list_placeholder)').remove();
        
        $('.artist_list_placeholder').show();
    }
    
    
    function initEventList(hidePlaceHolder) {
        $('#event_list li:not(.event_list_placeholder)').remove();
        
        if (hidePlaceHolder) {
            $('.event_list_placeholder').hide();
        } else {
            $('.event_list_placeholder').show();
        }
    }
    
    
    function validateUserName(callback) {
        var input = this;
        
        lastfm.getUserInfo($('#username').val(), function(info) {
            if (info) {
                callback(true);
            } else {
                callback(false);
            }
        });
    }
    
    
    function validateLocation() {
        if (locationInput.getPlace() && locationInput.getPlace().geometry) {
            return true;
        } else {
            return false;
        }
    }
    
    
    function getMapOptionsForRepositioning() {
        var mapOptions = null;
        
        if (validateLocation()) {;
            mapOptions = {
                center: locationInput.getPlace().geometry.location,
                zoom:   6
            };
        } else {
            mapOptions = {
                center: new google.maps.LatLng(52.5167, 13.3833), // Berlin for the win!! :)
                zoom:   5
            };
        }
        
        return mapOptions;
    }
    
    
    function handleFormSubmission(event) {
        event.preventDefault();
        
        //$('#status').html('Processing...');
        
        validateUserName(function(usernameValid) {
            if (!usernameValid) {
                //$('#status').html('Invalid username.');
                return;
            }
            
            var user       = $('#username').val();
            var maxArtists = parseInt($('#max_artists_value').html());
            
            initLists();
            initMap();
            
            lastfm.getTopArtists(user, maxArtists, handleTopArtists);
        });
    }
    
    
    function handleTopArtists(topArtists) {
        artists             = {};
        numArtists          = topArtists.length;
        numArtistsProcessed = 0;
        
        $.each(topArtists, function(i, artist) {
            artists[artist.mbid] = artist;
            lastfm.getEvents(artist.mbid, handleEvents);
        });
    }
    
    
    function handleEvents(mbid, events) {
        events.sort(function(event1, event2) {
            var rc = event1.venue.country.localeCompare(event2.venue.country);
            
            if (rc == 0) {
                rc = event1.venue.city.localeCompare(event2.venue.city);
            }
            
            return rc;
        });
        
        $.each(events, function(i, event) {
            var marker = new google.maps.Marker({
                position: new google.maps.LatLng(event.venue.latitude, event.venue.longitude),
                map: map,
                title: event.name + ' @ ' + event.venue.name
            });
            
            marker.artist = artists[mbid];
            marker.event  = event;
            
            event.marker = marker;
            
            markers.push(marker);
            
            google.maps.event.addListener(marker, 'click', handleMarkerClick);
        });
        
        if (events.length > 0) {
            $('.artist_list_placeholder').hide();
            
            var artistItem = $('<li>');
            artistItem.html(artists[mbid].name);
            artistItem.addClass('artist_list_item');
            $('#artist_list').append(artistItem);
            
            artistItem.click(function() {
                $('#artist_list li.selected').removeClass('selected');
                $(this).addClass('selected');
                
                initEventList(true);
                
                var country = null;
                
                $.each(events, function(i, event) {
                    if (! country || country.localeCompare(event.venue.country) != 0) {
                        var countryItem = $('<li>');
                        var countryWrapper = $('<div>');
                        countryWrapper.html(event.venue.country);
                        countryItem.append(countryWrapper);
                        countryItem.addClass('event_list_country_header');
                        $('#event_list').append(countryItem);
                        
                        country = event.venue.country;
                    }
                    
                    var eventItem = $('<li>');
                    eventItem.html(event.venue.city);
                    eventItem.addClass('event_list_item');
                    $('#event_list').append(eventItem);
                    
                    eventItem.click(function() {
                        map.setCenter(event.marker.position);
                        google.maps.event.trigger(event.marker, 'click');
                    });
                    
                    //event.marker.setIcon('http://maps.google.com/mapfiles/ms/icons/blue-dot.png');
                });
            });
        }
        
        numArtistsProcessed += 1;
        
        if (numArtistsProcessed == numArtists) {
            //$('#status').html('Done!');
        }
    }
    
    
    function handleMapClick() {
        dismissInfoWindow();
    }
    
    
    function handleMarkerClick() {
        dismissInfoWindow();
        
        var title    = this.event.name;
        var subtitle = null;
        
        if (title.search(this.artist.name) < 0) {
            subtitle = title;
            title    = this.artist.name;
        }
        
        var date = this.event.startDate.toLocaleDateString();
        
        if (this.event.endDate > this.event.startDate) {
            date += ' - ' + this.event.endDate.toLocaleDateString();
        } else {
            date += ' (' + this.event.startDate.toLocaleTimeString() + ')';
        }
        
        var content = '<div class="marker_info">'
                    +    '<div class="event_title">'
                    +      '<b>' + title + '</b>'
                    +   '</div>'
                    +    '<div class="event_subtitle">'
                    +      (subtitle ? subtitle : '')
                    +   '</div>'
                    +    '<div class="event_venue">'
                    +      this.event.venue.name + ', ' + this.event.venue.city
                    +   '</div>'
                    +    '<div class="event_date">'
                    +      date
                    +   '</div>'
                    + '</div>';
        
        infoWindow = new google.maps.InfoWindow({
            content: content
        });
        
        infoWindow.open(map, this);
    }
    
    
    function dismissInfoWindow() {
        if (infoWindow) {
            infoWindow.close();
            infoWindow = null;
        }
    }
    
})(jQuery);
