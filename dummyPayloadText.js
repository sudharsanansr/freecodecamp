{
    "deviceProperties": {
      "mute": false,
      "priority": 2,
      "assignment_group": "IT Systems SRT",
      "business_service": "Monitoring (Systems)",
      "category": "IT Business Services",
      "sub_category": "Systems"
    },
    "datasources": {
           "data_source_A":{
              "info":{
                 "mute":false,
                 "evt_assignment_group":"Corporate",
                 "business_service":"Internal IT",
                 "category":"Network",
                 "sub_category":"Switch"
              },
              "dataPoints":{
                 "datapoint_1":{
                    "info":{
                       "mute":false,
                       "priority":"2"
                    },
                    "thresholds":{
                       "operator":">",
                       "warning":null,
                       "Error":85,
                       "critical":92
                    }
                 },
                 "datapoint_2":{
                    "info":{
                       "mute":false,
                       "priority":"2"
                    },
                    "thresholds":{
                       "operator":">",
                       "warning":null,
                       "Error":null,
                       "critical":92
                    }
                 }
              }
           },
           "data_source_B":{
              "info":{
                 "mute":false,
                 "evt_assignment_group":"Corporate",
                 "business_service":"Internal IT",
                 "category":"Network",
                 "sub_category":"Switch"
              },
              "dataPoints":{
                 "datapoint_1":{
                    "info":{
                       "mute":false,
                       "priority":"2"
                    },
                    "thresholds":{
                       "operator":">",
                       "warning":null,
                       "Error":85,
                       "critical":92
                    }
                 },
                 "datapoint_2":{
                    "info":{
                       "mute":false,
                       "priority":"2"
                    },
                    "thresholds":{
                       "operator":">",
                       "warning":null,
                       "Error":null,
                       "critical":92
                    }
                 }
              }
          }
    }
  }