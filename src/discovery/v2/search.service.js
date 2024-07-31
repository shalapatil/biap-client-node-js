import _ from "lodash";
import { onSearch } from "../../utils/protocolApis/index.js";
import ContextFactory from "../../factories/ContextFactory.js";
import BppSearchService from "./bppSearch.service.js";
import { CITY_CODE } from "../../utils/cityCode.js";
import createPeriod from "date-period";
import translateObject from "../../utils/bhashini/translate.js";
import { OBJECT_TYPE } from "../../utils/constants.js";
// import logger from "../lib/logger";
const bppSearchService = new BppSearchService();
import client from "../../database/elasticSearch.js";

class SearchService {
  isBppFilterSpecified(context = {}) {
    return typeof context.bpp_id !== "undefined";
  }

  async search(searchRequest = {}, targetLanguage = "en") {
    try {
      // providerIds=ondc-mock-server-dev.thewitslab.com_ONDC:RET10_ondc-mock-server-dev.thewitslab.com
      let matchQuery = [];

      // bhashini translated data
      matchQuery.push({
        match: {
          language: targetLanguage,
        },
      });

      if (searchRequest.name) {
        matchQuery.push({
          match: {
            "item_details.descriptor.name": searchRequest.name,
          },
        });
      }

      if (searchRequest.providerIds) {
        matchQuery.push({
          match: {
            "provider_details.id": searchRequest.providerIds,
          },
        });
      }

      if (searchRequest.categoryIds) {
        matchQuery.push({
          match: {
            "item_details.category_id": searchRequest.categoryIds,
          },
        });
      }

      let productAttrParams = {}
      for (const [key, value] of Object.entries(searchRequest)) {
        if (key.startsWith('product_attr_')) {
            const attributeName = key.slice('product_attr_'.length);
            // productAttrParams[attributeName] = value;
            let values = value.split(',');
            for(let valueObj of values){
              if(valueObj){
                matchQuery.push({
                  "nested": {
                    "path": "attribute_key_values",
                    "query": {
                      "bool": {
                        "must": [
                          {
                            "term": {
                              "attribute_key_values.key": attributeName
                            }
                          },
                          {
                            "term": {
                              "attribute_key_values.value": valueObj
                            }
                          }
                        ]
                      }
                    }
                  }
                });
              }
            }

        }
    }

    //  return productAttrParams;

      // for variants we set is_first = true
      matchQuery.push({
        match: {
          is_first: true,
        },
      });

      let query_obj = {
        bool: {
          must: matchQuery,
        },
        // "should": [ //TODO: enable this once UI apis have been changed
        //     {
        //         "match": {
        //             "location_details.type.keyword": "pan"
        //         }
        //     },
        //     {
        //         "geo_shape": {
        //             "location_details.polygons": {
        //                 "shape": {
        //                     "type": "point",
        //                     "coordinates": [lat, lng]
        //                 }
        //             }
        //         }
        //     }
        // ]
      };

      // Calculate the starting point for the search
      let size = parseInt(searchRequest.limit);
      let page = parseInt(searchRequest.pageNumber);
      const from = (page - 1) * size;

      // Perform the search with pagination parameters
      let queryResults = await client.search({
        query: query_obj,
        from: from,
        size: size,
      });

      // Extract the _source field from each hit
      let sources = queryResults.hits.hits.map((hit) => hit._source);

      // Get the total count of results
      let totalCount = queryResults.hits.total.value;

      // Return the total count and the sources
      return {
        response: {
          count: totalCount,
          data: sources,
          pages: parseInt(totalCount / size),
        },
      };
    } catch (err) {
      throw err;
    }
  }

  async globalSearchItems(searchRequest = {}, targetLanguage = "en") {
    try {
      // providerIds=ondc-mock-server-dev.thewitslab.com_ONDC:RET10_ondc-mock-server-dev.thewitslab.com
      let matchQuery = [];
      let searchQuery = [];

      // bhashini translated data
      matchQuery.push({
        match: {
          language: targetLanguage,
        },
      });

      if (searchRequest.name) {
        matchQuery.push({
          match: {
            "item_details.descriptor.name": searchRequest.name,
          },
        });
        searchQuery.push({
          match: {
            "item_details.descriptor.short_desc": searchRequest.name,
          },
        });
        searchQuery.push({
          match: {
            "item_details.descriptor.long_desc": searchRequest.name,
          },
        });
        searchQuery.push({
          match: {
            "item_details.category_id": searchRequest.name,
          },
        });
      }

      if (searchRequest.providerIds) {
        matchQuery.push({
          match: {
            "provider_details.id": searchRequest.providerIds,
          },
        });
      }

      if (searchRequest.categoryIds) {
        matchQuery.push({
          match: {
            "item_details.category_id": searchRequest.categoryIds,
          },
        });
      }

      // for variants we set is_first = true
      matchQuery.push({
        match: {
          is_first: true,
        },
      });

      searchQuery.push({
        match: {
          "location_details.type": "pan",
        },
      });

      if (searchRequest.latitude && searchRequest.longitude)
        searchQuery.push({
          geo_shape: {
            "location_details.polygons": {
              shape: {
                type: "point",
                coordinates: [
                  parseFloat(searchRequest.latitude),
                  parseFloat(searchRequest.longitude),
                ],
              },
            },
          },
        });

      let query_obj = {
        bool: {
          must: matchQuery,
          should: searchQuery,
        },
      };

      // Calculate the starting point for the search
      let size = parseInt(searchRequest.limit);
      let page = parseInt(searchRequest.pageNumber);
      const from = (page - 1) * size;

      console.log(query_obj);
      // Perform the search with pagination parameters
      let queryResults = await client.search({
        query: query_obj,
        sort: [
          {
            _score: {
              order: "desc",
            },
          },
        ],
        from: from,
        size: size,
      });

      // Extract the _source field from each hit
      let sources = queryResults.hits.hits.map((hit) => hit._source);

      // Get the total count of results
      let totalCount = queryResults.hits.total.value;

      // Return the total count and the sources
      return {
        count: totalCount,
        data: sources,
        pages: parseInt(Math.round(totalCount / size)),
      };
    } catch (err) {
      throw err;
    }
  }

  async getItems(searchRequest = {}, targetLanguage = "en") {
    try {
      let matchQuery = [];

      // bhashini translated data
      matchQuery.push({
        match: {
          language: targetLanguage,
        },
      });

      if (searchRequest.customMenu) {
        matchQuery.push({
          nested: {
            path: "customisation_menus",
            query: {
              bool: {
                must: [
                  {
                    match: {
                      "customisation_menus.id": searchRequest.customMenu,
                    },
                  },
                ],
              },
            },
          },
        });
      }

      let query_obj = {
        bool: {
          must: matchQuery,
        },
      };

      // Perform the search with pagination parameters
      let queryResults = await client.search({
        body: {
          query: query_obj,
        },
      });

      // Extract the _source field from each hit
      let sources = queryResults.hits.hits.map((hit) => hit._source);

      // Get the total count of results
      let totalCount = queryResults.hits.total.value;

      // Return the total count and the sources
      return {
        response: {
          count: totalCount,
          data: sources,
          pages: totalCount,
        },
      };
    } catch (err) {
      throw err;
    }
  }

  async getProvideDetails(searchRequest = {}, targetLanguage = "en") {
    try {
      // id=pramaan.ondc.org/alpha/mock-server_ONDC:RET12_pramaan.ondc.org/alpha/mock-server
      let matchQuery = [];

      matchQuery.push({
        match: {
          language: targetLanguage,
        },
      });

      if (searchRequest.id) {
        matchQuery.push({
          match: {
            "provider_details.id": searchRequest.id,
          },
        });
      }

      let query_obj = {
        bool: {
          must: matchQuery,
        },
      };

      let queryResults = await client.search({
        query: query_obj,
      });

      console.log(queryResults);

      let provider_details = null;
      if (queryResults.hits.hits.length > 0) {
        let details = queryResults.hits.hits[0]._source; // Return the source of the first hit
        provider_details = {
          domain: details.context.domain,
          ...details.provider_details,
        };
      }

      return provider_details;
    } catch (err) {
      throw err;
    }
  }

  async getLocationDetails(searchRequest = {}, targetLanguage = "en") {
    try {
      // providerIds=ondc-mock-server-dev.thewitslab.com_ONDC:RET10_ondc-mock-server-dev.thewitslab.com
      let matchQuery = [];

      matchQuery.push({
        match: {
          language: targetLanguage,
        },
      });

      if (searchRequest.id) {
        matchQuery.push({
          match: {
            "location_details.id": searchRequest.id,
          },
        });
      }

      matchQuery.push({
        match: {
          "type": 'item',
        },
      });

      let query_obj = {
        bool: {
          must: matchQuery,
        },
      };

      let queryResults = await client.search({
        query: query_obj,
      });

      let location_details = null;
      if (queryResults.hits.hits.length > 0) {
        let details = queryResults.hits.hits[0]._source; // Return the source of the first hit
        location_details = {
          domain: details.context.domain,
          provider_descriptor: details.provider_details.descriptor,
          ...details.location_details,
          time_to_ship: details.item_details["@ondc/org/time_to_ship"]
        };
      }

      return location_details;
    } catch (err) {
      throw err;
    }
  }

  async getItemDetails(searchRequest = {}, targetLanguage = "en") {
    try {
      // providerIds=ondc-mock-server-dev.thewitslab.com_ONDC:RET10_ondc-mock-server-dev.thewitslab.com
      let matchQuery = [];

      matchQuery.push({
        match: {
          language: targetLanguage,
        },
      });

      if (searchRequest.id) {
        matchQuery.push({
          match: {
            id: searchRequest.id,
          },
        });
      }

      let query_obj = {
        bool: {
          must: matchQuery,
        },
      };

      let queryResults = await client.search({
        index: 'items',
        query: query_obj,
      });

      let item_details = null;
      if (queryResults.hits.hits.length > 0) {
        item_details = queryResults.hits.hits[0]._source; // Return the source of the first hit
        item_details.customisation_items = [];

        // add variant details if available
        if (item_details.item_details.parent_item_id) {
          // hit db to find all related items
          let matchQuery = [];

          matchQuery.push({
            match: {
              language: targetLanguage,
            },
          });

          matchQuery.push({
            match: {
              "item_details.parent_item_id":
                item_details.item_details.parent_item_id,
            },
          });

          // match provider id
          matchQuery.push({
            match: {
              "provider_details.id": item_details.provider_details.id,
            },
          });

          // match location id
          matchQuery.push({
            match: {
              "location_details.id": item_details.location_details.id,
            },
          });

          matchQuery.push(
            {
              match: {
                language: targetLanguage,
              },
            })

          let query_obj = {
            bool: {
              must: matchQuery,
            },
          };

          let queryResults = await client.search({
            query: query_obj,
            size:100
          });

          item_details.related_items = queryResults.hits.hits.map(
            (hit) => {
             let data =  hit._source 

                   //map attribute keys 
      const flatObject = {};
      if(data.attribute_key_values && data.attribute_key_values.length>0){
        data.attribute_key_values.forEach(pair => {
          flatObject[pair.key] = pair.value;
      });
      }
      data.attributes = flatObject

            return  data;
            
            },
          );
        } else if (item_details.customisation_groups.length > 0) {
          //fetch all customisation items - customisation_group_id
          let customisationQuery = [];
          let groupIds = item_details.customisation_groups.map((data) => {
            return data.id;
          });

          console.log("groupids---->", groupIds);
          customisationQuery.push({
            terms: {
              customisation_group_id: groupIds,
            },
          });

          // Add the match query for type
          customisationQuery.push({
            match: {
              type: "customization",
            },
          });

          customisationQuery.push(
            {
              match: {
                language: targetLanguage,
              },
            });
            
          // Create the query object
          let query_obj = {
            bool: {
              must: customisationQuery,
            },
          };

          let queryResults = await client.search({
            query: query_obj,
            size: 100
          });

          console.log(queryResults);
          item_details.customisation_items = queryResults.hits.hits.map(
            (hit) => hit._source,
          );
        }
      }
                 console.log("itemdetails--->",item_details)
      item_details.locations = [item_details.location_details]

      //map attribute keys 
      const flatObject = {};
      if(item_details.attribute_key_values && item_details.attribute_key_values.length>0){
        item_details.attribute_key_values.forEach(pair => {
          flatObject[pair.key] = pair.value;
      });
      }
      item_details.attributes = flatObject

      return item_details;

      // TODO: attach related items
      // TODO: attach customisations
    } catch (err) {
      throw err;
    }
  }

  async getAttributes(searchRequest) {
    try {
      let matchQuery = [];
  
      if (searchRequest.category) {
        matchQuery.push({
          match: {
            "item_details.category_id": searchRequest.category,
          },
        });
      }
  
      if (searchRequest.provider) {
        matchQuery.push({
          match: {
            "provider_details.id": searchRequest.provider,
          },
        });
      }
  
      const response = await client.search({
        index: 'items',
        size: 0, // We don't need actual documents, only aggregation results
        body: {
          query: {
            bool: {
              must: matchQuery
            }
          },
          aggs: {
            unique_attribute_keys: {
              nested: {
                path: 'attribute_key_values'
              },
              aggs: {
                unique_keys: {
                  terms: {
                    field: 'attribute_key_values.key',
                    size: 1000  // Adjust the size as needed
                  }
                }
              }
            }
          }
        }
      });
  
      const uniqueKeys = response.aggregations.unique_attribute_keys.unique_keys.buckets.map((bucket) =>  { return {code:bucket.key}});
      console.log(uniqueKeys);

      return { response: { data: uniqueKeys, count: uniqueKeys.length, pages: 1 } };
      

    } catch (err) {
      throw err;
    }
  }

  async getUniqueCategories(searchRequest, targetLanguage = "en") {
    let matchQuery = [];

    if (searchRequest.domain) {
      matchQuery.push({
        match: {
          "context.domain": searchRequest.domain,
        },
      });
    }

    matchQuery.push({
      match: {
        language: targetLanguage,
      },
    });

    let query_obj = {
      bool: {
        must: matchQuery,
      },
    };

    const totalCategories = await client.search({
      index: "items",
      size: 0,
      query: query_obj,
      aggs: {
        domainCategories: {
          terms: {
            field: "context.domain",
            size:10000000
          },
          aggs: {
            uniqueCategories: {
              terms: {
                field: "item_details.category_id",
                size:1000000
              },
            },
          },
        },
      },
    });

    console.log("CATEGORIES", totalCategories);
  
    const domainBuckets = totalCategories.aggregations.domainCategories.buckets;

    console.log("DOMAIN BUCKETS", totalCategories.aggregations.domainCategories.buckets);

    let result = {};
  
    domainBuckets.forEach(domainBucket => {
      const domainName = domainBucket.key;
      const uniqueCategories = domainBucket.uniqueCategories.buckets.map(category => {
        return { code: category.key, label: category.key };
      });
  
      result[domainName] = uniqueCategories;
    });
  
    return result;
  }
  
  async getAttributesValues(searchRequest) {
    try {
      let matchQuery = [];
  
      if (searchRequest.category) {
        matchQuery.push({
          match: {
            "item_details.category_id": searchRequest.category,
          },
        });
      }
  
      if (searchRequest.provider) {
        matchQuery.push({
          match: {
            "provider_details.id": searchRequest.provider,
          },
        });
      }
  
      // Create the nested query based on the provided attribute key
      let attributeQuery = {
        nested: {
          path: "attribute_key_values",
          query: {
            bool: {
              must: [
                { term: { "attribute_key_values.key": searchRequest.attribute_code} }  // Replace "gender" as needed
              ]
            }
          }
        }
      };
  
      // Combine all the queries
      const response = await client.search({
        index: 'items',
        body: {
          size: 0,
          query: {
            bool: {
              must: [
                ...matchQuery,
                attributeQuery
              ]
            }
          },
          aggs: {
            unique_attribute_values: {
              nested: {
                path: "attribute_key_values"
              },
              aggs: {
                filtered_attribute: {
                  filter: {
                    term: {
                      "attribute_key_values.key": searchRequest.attribute_code// Replace "gender" as needed
                    }
                  },
                  aggs: {
                    unique_values: {
                      terms: {
                        field: "attribute_key_values.value",
                        size: 1000  // Adjust the size as needed
                      }
                    }
                  }
                }
              }
            }
          }
        },
      });
  
      // Access the aggregation results correctly
      const uniqueValues = response.aggregations.unique_attribute_values.filtered_attribute.unique_values.buckets.map(
        (bucket) => bucket.key,
      );
  
      // Return the result
      return { response: { data: uniqueValues, count: uniqueValues.length } };
  
    } catch (err) {
      throw err;
    }
  }
  async getLocations(searchRequest, targetLanguage = "en") {
    try {
        // Match queries for filtering
        let matchQuery = [
            { match: { language: targetLanguage } },
            { match: { type: 'item' } }
        ];

        if (searchRequest.domain) {
            matchQuery.push({ match: { "context.domain": searchRequest.domain } });
        }

        if (searchRequest.provider) {
            matchQuery.push({ match: { "provider_details.id": searchRequest.provider } });
        }

        // Build the main query object
        let query_obj = {
            bool: {
                must: [...matchQuery, { exists: { field: "location_details" } }],
                should: [
                    {
                      geo_distance_range: {
                        from: '5km',
                        to: '10km',
                        "location_details.circle.gps": {
                          lat: parseFloat(searchRequest.latitude),
                          lon: parseFloat(searchRequest.longitude),
                        },
                      },
                    },
                ],
                minimum_should_match: 1
            },
        };

        // Perform the Elasticsearch search
        let queryResults = await client.search({
            index: 'items', // specify your index name
            body: {
                size: 0,
                query: query_obj,
                aggs: {
                    unique_location: {
                        composite: {
                            size: searchRequest.limit,
                            sources: [
                                {
                                    location_id: {
                                        terms: {
                                            field: "location_details.id"
                                        }
                                    }
                                }
                            ],
                            after: searchRequest.afterKey ? { location_id: searchRequest.afterKey } : undefined
                        },
                        aggs: {
                            top_product: {
                                top_hits: {
                                    size: 1,
                                    _source: {
                                        includes: [
                                            "location_details.circle.gps",
                                            "location_details.median_time_to_ship",
                                            "context.domain",
                                            "provider_details.descriptor",
                                            "provider_details.id"
                                        ]
                                    }
                                }
                            },
                            distance_and_time: {
                                scripted_metric: {
                                    init_script: "state.distances = []",
                                    map_script: `
                                        if (doc['location_details.circle.gps'].size() > 0 && doc['location_details.median_time_to_ship'].size() > 0) {
                                            def lat = doc['location_details.circle.gps'].lat;
                                            def lon = doc['location_details.circle.gps'].lon;
                                            def timeToShip = doc['location_details.median_time_to_ship'].value;
                                            double lat1 = params.lat * Math.PI / 180;
                                            double lon1 = params.lon * Math.PI / 180;
                                            double lat2 = lat * Math.PI / 180;
                                            double lon2 = lon * Math.PI / 180;
                                            double dLat = lat2 - lat1;
                                            double dLon = lon2 - lon1;
                                            double a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
                                            double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                                            double earthRadius = 6371;
                                            double distance = earthRadius * c;
                                            distance = ((distance * 60) / 15) + (timeToShip / 60);
                                            state.distances.add(distance);
                                        }
                                    `,
                                    combine_script: "state.distances",
                                    reduce_script: `
                                        double minDist = Double.POSITIVE_INFINITY;
                                        for (d in states) {
                                            for (dist in d) {
                                                if (dist < minDist) {
                                                    minDist = dist;
                                                }
                                            }
                                        }
                                        return minDist;
                                    `,
                                    params: {
                                        lat: parseFloat(searchRequest.latitude),
                                        lon: parseFloat(searchRequest.longitude)
                                    }
                                }
                            },
                            sorted_buckets: {
                                bucket_sort: {
                                    sort: [
                                        {
                                            "distance_and_time.value": {
                                                order: "asc"
                                            }
                                        }
                                    ],
                                    size: searchRequest.limit
                                }
                            }
                        }
                    },
                    unique_location_count: {
                        cardinality: {
                            field: "location_details.id"
                        }
                    }
                }
            }
        });

        // Extract unique locations from search results
        let unique_locations = queryResults.aggregations.unique_location.buckets.map(bucket => {
            const details = bucket.top_product.hits.hits[0]._source;
            let distance = 0;
            if (details.location_details.circle && details.location_details.circle.gps) {
                const gps = details.location_details.circle.gps.split(',');
                const docLat = parseFloat(gps[0]);
                const docLon = parseFloat(gps[1]);
                const lat1 = docLat * Math.PI / 180;
                const lon1 = docLon * Math.PI / 180;
                const lat2 = parseFloat(searchRequest.latitude) * Math.PI / 180;
                const lon2 = parseFloat(searchRequest.longitude) * Math.PI / 180;
                const dLat = lat2 - lat1;
                const dLon = lon2 - lon1;
                const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                          Math.cos(lat1) * Math.cos(lat2) *
                          Math.sin(dLon / 2) * Math.sin(dLon / 2);
                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                const earthRadius = 6371; // Earth's radius in kilometers
                distance = earthRadius * c;
            }

            const timeToShip = details.location_details.median_time_to_ship ? details.location_details.median_time_to_ship : 0;

            return {
                combined_distance_and_time: ((distance * 60) / 15) + (timeToShip / 60),
                distance: distance,
                time_to_ship: timeToShip
            };
        });

        // Get total count and pagination details
        let totalCount = queryResults.aggregations.unique_location_count.value;
        let afterKey = queryResults.aggregations.unique_location.after_key;
        let totalPages = Math.ceil(totalCount / searchRequest.limit);

        // Return the response with count, data, afterKey, and pages
        return {
            count: totalCount,
            data: unique_locations,
            afterKey: afterKey,
            pages: totalPages,
        };

    } catch (err) {
        console.error(err); // Log the error for debugging
        throw err;
    }
}



  async getGlobalProviders(searchRequest, targetLanguage = "en") {
    try {
      console.log("searchRequest", searchRequest);

      // Define the query object with additional filters on names
      let query_obj = {
        bool: {
          must: [
            {
              bool: {
                should: [

                  {
                    "match_phrase": {
                      "provider_details.descriptor.name":searchRequest.name
                    }
                  },{
                    "match_phrase": {
                      "item_details.descriptor.name": searchRequest.name,
                    },
                  },{
                    "match_phrase": {
                      "item_details.descriptor.short_desc": searchRequest.name,
                    },},
                    {
                    "match_phrase": {
                      "item_details.descriptor.long_desc": searchRequest.name,
                    },},
                    {
                    "match_phrase": {
                      "item_details.category_id": searchRequest.name,
                    },}
                ],
              },
            },
            //default language search
            {
              match: {
                language: targetLanguage,
              },
            },
            {
              bool: {
                should: [
                  {
                    match: {
                      "location_details.type": "pan",
                    },
                  },
                  {
                    geo_shape: {
                      "location_details.polygons": {
                        shape: {
                          type: "point",
                          coordinates: [
                            parseFloat(searchRequest.latitude),
                            parseFloat(searchRequest.longitude),
                          ],
                        },
                      },
                    },
                  },
                ],
              },
            },
          ],
        },
      };

      // Define the aggregation query
      let aggr_query = {
        unique_providers: {
          composite: {
            size: searchRequest.limit,
            sources: [
              { provider_id: { terms: { field: "location_details.id" } } }
            ],
            after: searchRequest.afterKey ? { provider_id: searchRequest.afterKey } : undefined
          },
          aggs: {
            products: {
              top_hits: {
                size: 100,
              }
            }
          }
        },
        unique_provider_count: {
          cardinality: {
            field: "location_details.id"
          }
        }
      };

      // Perform the search query with the defined query and aggregation
      let queryResults = await client.search({
        body: {
          query: query_obj,
          aggs: aggr_query,
          size: 0,
        }
      });

      // Extract unique providers from the aggregation results
      let unique_providers = queryResults.aggregations.unique_providers.buckets.map(bucket => {
        return { ...bucket.products.hits.hits[0]._source.provider_details, items: bucket.products.hits.hits.map((hit) => hit._source) };
      });

      // Get the unique provider count
      let totalCount = queryResults.aggregations.unique_provider_count.value;
      let totalPages = Math.ceil(totalCount / searchRequest.limit);

      // Get the after key for pagination
      let afterKey = queryResults.aggregations.unique_providers.after_key;

      // Return the response with count, data, afterKey, and pages
      return {
        response: {
          count: totalCount,
          data: unique_providers,
          afterKey: afterKey,
          pages: totalPages,
        }
      };

    } catch (err) {
      throw err;
    }
  }

  async getProviders(searchRequest, targetLanguage = "en") {
    try {
      console.log("searchRequest", searchRequest)
      let query_obj = {
        bool: {
          must: [
            {
              match: {
                language: targetLanguage,
              }
            }
          ]
        }
      };

      let aggr_query = {
        unique_providers: {
          composite: {
            size: searchRequest.limit,
            sources: [
              { provider_id: { terms: { field: "provider_details.id" } } }
            ],
            after: searchRequest.afterKey ? { provider_id: searchRequest.afterKey } : undefined
          },
          aggs: {
            products: {
              top_hits: {
                size: 1,
              }
            }
          }
        },
        unique_provider_count: {
          cardinality: {
            field: "provider_details.id"
          }
        }
      };

      let queryResults = await client.search({
        body: {
          query: query_obj,
          aggs: aggr_query,
          size: 0
        }
      });

      let unique_providers = queryResults.aggregations.unique_providers.buckets.map(bucket => {
        return bucket.products.hits.hits[0]._source.provider_details;
      });

      let totalCount = queryResults.aggregations.unique_provider_count.value;
      let totalPages = Math.ceil(totalCount / searchRequest.limit);

      let afterKey = queryResults.aggregations.unique_providers.after_key;

      return {
        response: {
          count: totalCount,
          data: unique_providers,
          afterKey: afterKey,
          pages: totalPages
        }
      };

    } catch (err) {
      throw err;
    }
  }

  async getProviders1(indexName, pageSize, afterKey = null) {
    const body = {
      size: 0, // We don't need the actual documents, only the aggregation results
      aggs: {
        unique_provider_ids: {
          composite: {
            size: 20,
            sources: [
              { provider_id: { terms: { field: 'provider_details.id' } } }
            ]
          }
        }
      }
    };

    // If afterKey is provided, add it to the request body
    if (afterKey) {
      body.aggs.unique_provider_ids.after = afterKey;
    }

    const { body: response } = await client.search({
      body
    });

    return response.aggregations.unique_provider_ids;
  }

  async getCustomMenu(searchRequest, targetLanguage = "en") {
    try {
      let matchQuery = [];

      matchQuery.push({
        match: {
          language: targetLanguage,
        },
      });

      if (searchRequest.provider) {
        matchQuery.push({
          match: {
            "provider_details.id": searchRequest.provider,
          },
        });
      }

      let queryResults = await client.search({
        query: {
          bool: {
            must: [
              {
                term: {
                  "provider_details.id": searchRequest.provider,
                },
              },
            ],
          },
        },
        aggs: {
          unique_menus: {
            nested: {
              path: "customisation_menus",
            },
            aggs: {
              filtered_menus: {
                terms: {
                  field: "customisation_menus.id",
                },
                aggs: {
                  menu_details: {
                    top_hits: {
                      size: 1,
                    },
                  },
                },
              },
            },
          },
        },
      });

      let customisationMenus = [];
      const buckets =
        queryResults.aggregations.unique_menus.filtered_menus.buckets;

      buckets.forEach((bucket) => {
        const menuDetails = bucket.menu_details.hits.hits.map(
          (hit) => hit._source,
        )[0];
        customisationMenus.push(menuDetails);
      });
      console.log("Unique IDs with documents:", customisationMenus);
      return {
        data: customisationMenus,
        count: customisationMenus.length,
        pages: customisationMenus.length,
      };
    } catch (err) {
      throw err;
    }
  }

  async getOffers(searchRequest, targetLanguage = "en") {
    try {
      let matchQuery = [];
      let searchQuery = [];

      matchQuery.push({
        match: {
          language: targetLanguage,
        },
      });

      searchQuery.push({
        match: {
          "location_details.type": "pan",
        },
      });

      if (searchRequest.latitude && searchRequest.longitude)
        searchQuery.push({
          geo_shape: {
            "location_details.polygons": {
              shape: {
                type: "point",
                coordinates: [
                  parseFloat(searchRequest.latitude),
                  parseFloat(searchRequest.longitude),
                ],
              },
            },
          },
        });

      if (searchRequest.provider) {
        matchQuery.push({
          match: {
            "provider_details.id": searchRequest.provider,
          },
        });
      }
      if (searchRequest.location) {
        matchQuery.push({
          match: {
            "location_details.id": searchRequest.location,
          },
        });
      }
      let queryResults = await client.search({
        index: 'offers',
        query: {
          bool: {
            must: matchQuery,
            should: searchQuery
          },
        },
        size: 20
      });

      // Extract the _source field from each hit
      let sources = queryResults.hits.hits.map((hit) => {
        return { ...hit._source, provider: hit._source.provider_details.id, provider_descriptor: hit._source.provider_details.descriptor, location: hit._source.location_details.id, domain: hit._source.context.domain, id: hit._source.local_id };
      });

      // Get the total count of results
      let totalCount = queryResults.hits.total.value;

      // Return the total count and the sources
      return {
        response: {
          count: totalCount,
          data: sources,
        },
      };


    } catch (err) {
      throw err;
    }
  }

}

export default SearchService;
