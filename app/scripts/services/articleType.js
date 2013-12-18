'use strict';

angular.module('authoringEnvironmentApp')
  .service('Articletype', function Articletype($resource, endpoint) {
    // AngularJS will instantiate a singleton by calling "new" on this function
    return $resource(endpoint+'/api/articleTypes/:type', {}, {
      query: {method: 'GET', params: {type: ''}, isArray: true}
    });
  });
